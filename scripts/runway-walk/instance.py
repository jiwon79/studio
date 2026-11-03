"""Prompted instance support for crowded runway shots; RGB still comes from film."""
import hashlib
from pathlib import Path
import cv2
import numpy as np

REPO = 'facebook/sam2.1-hiera-tiny'
REVISION = 'de431c4043854a71d8101e17995dfe596bf101a5'
FILES = {
    'model.safetensors': '48c14467e5cf9e51870511feb72c89688e82dd74523142c0538b663e193ac2a7',
    'config.json': '860aff9751b139d83a4ad7df1e5535416fded533e0ead02625edbefcb9953cce',
    'processor_config.json': 'f8a68e865cfad115c1c2763f3d93eca7b1c622da06da2a9273eb437fb2389b6d',
    'preprocessor_config.json': '6ebf229ee259368ce4a8d4f2fe893a72b053023710853e257253939e601f583d',
}

class InstanceSupport:
    def __init__(self, cache: Path, device='mps'):
        import torch
        from transformers import Sam2Model, Sam2Processor
        root=cache/'sam2-tiny'
        for name, checksum in FILES.items():
            path=root/name
            if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=checksum:
                raise RuntimeError('Run prepare-instance.py before instance-supported extraction')
        self.device=device
        self.dtype=torch.float16 if device=='mps' else torch.float32
        self.model=Sam2Model.from_pretrained(root,local_files_only=True,dtype=self.dtype).to(device).eval()
        self.processor=Sam2Processor.from_pretrained(root,local_files_only=True)
        self.fingerprint=hashlib.sha256((REVISION+Path(__file__).read_text()).encode()).hexdigest()

    def infer(self, rgb, pose, accessories=(), threshold=0.0, head_threshold=None):
        import torch
        from PIL import Image
        h,w=rgb.shape[:2]
        xy=pose[:,:2]*[w,h]
        # Prompt only landmarks that were actually visible in this frame.
        points=[xy[0].tolist(),xy[[11,12]].mean(0).tolist(),xy[[23,24]].mean(0).tolist()]
        points += [xy[k].tolist() for k in [11,12,13,14,15,16,25,26,27,28] if pose[k,3]>.6]
        objects=[points]+[[[float(x)*w,float(y)*h]] for x,y in accessories]
        inputs=self.processor(images=Image.fromarray(rgb),input_points=[objects],
            input_labels=[[[1]*len(points) for points in objects]],return_tensors='pt').to(self.device)
        inputs['pixel_values']=inputs['pixel_values'].to(self.dtype)
        with torch.inference_mode():output=self.model(**inputs,multimask_output=False)
        logits=self.processor.post_process_masks(output.pred_masks.float().cpu(),inputs['original_sizes'].cpu(),binarize=False)[0][:,0].numpy()
        # This is an exclusion boundary; the direct matte supplies the alpha.
        # A strict semantic threshold can punch holes in real hair and shoes.
        support=(logits>threshold).any(axis=0).astype('uint8')
        if head_threshold is not None:
            end=max(0,min(h,round(min(pose[11,1],pose[12,1])*h)))
            support[:end]=(logits[:,:end]>head_threshold).any(axis=0).astype('uint8')
        # Let the direct matting alpha supply the fine hair, strap and cloth edge.
        support=cv2.morphologyEx(support,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
        return cv2.dilate(support,np.ones((7,7),np.uint8))

    def matte(self, alpha, support):
        alpha=np.clip((alpha-.015)/.97,0,1)*support
        count,labels,stats,_=cv2.connectedComponentsWithStats((alpha>.35).astype('uint8'))
        keep=np.zeros(count,np.uint8)
        keep[1:]=(stats[1:,cv2.CC_STAT_AREA]>=24)
        islands=cv2.dilate(keep[labels],np.ones((3,3),np.uint8))
        return alpha*islands
