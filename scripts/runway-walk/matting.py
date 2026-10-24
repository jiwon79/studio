"""Local BiRefNet inference; cache raw masks before selecting a subject."""
import hashlib
import cv2
import numpy as np

class MatteModel:
    def __init__(self,cache,engine):
        self.engine=engine;self.model=None
        self.path=cache/('birefnet-torch' if engine=='mps' else 'birefnet-lite.onnx')
        files=[self.path/f for f in ['model.safetensors','birefnet.py','BiRefNet_config.py','config.json']] if engine=='mps' else [self.path]
        hashes=[hashlib.sha256(p.read_bytes()).digest() for p in files]
        self.weights_sha256=hashes[0].hex()
        self.fingerprint=hashlib.sha256(b''.join(hashes)+engine.encode()).hexdigest()

    def infer(self,rgb):
        small=cv2.resize(rgb,(1024,1024),interpolation=cv2.INTER_AREA).astype(np.float32)/255
        tensor=((small-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)).transpose(2,0,1)[None]
        if self.engine=='mps':
            import torch
            if self.model is None:
                from transformers import AutoModelForImageSegmentation
                if not torch.backends.mps.is_available():raise RuntimeError('Apple MPS is unavailable; use --engine onnx')
                torch.set_num_threads(4)
                self.model=AutoModelForImageSegmentation.from_pretrained(str(self.path),trust_remote_code=True,local_files_only=True).eval().to('mps').half()
            with torch.inference_mode():
                mask=self.model(torch.from_numpy(tensor).to('mps').half())[-1].sigmoid()[0,0].float().cpu().numpy()
        else:
            import onnxruntime as ort
            if self.model is None:
                options=ort.SessionOptions();options.intra_op_num_threads=4
                self.model=ort.InferenceSession(str(self.path),sess_options=options,providers=['CPUExecutionProvider'])
            logits=self.model.run(None,{self.model.get_inputs()[0].name:tensor})[0][0,0]
            mask=1/(1+np.exp(-np.clip(logits,-40,40)))
        if not np.isfinite(mask).all():raise ValueError('Invalid inference mask')
        return cv2.resize(mask,(rgb.shape[1],rgb.shape[0]),interpolation=cv2.INTER_LINEAR)
