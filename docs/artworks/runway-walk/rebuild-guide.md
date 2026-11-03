# Runway Walk 재제작

웹 작품은 이미 만들어진 사진과 JSON을 읽는다. Python과 AI 모델은 원본 영상에서 사진·동작 데이터를 다시 추출할 때만 필요하다. 일반 개발·빌드는 `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm build`로 진행한다.

재제작용 Python 패키지 목록은 이 문서에만 보관한다. `scripts/runway-walk/requirements*.txt`는 제거했으며, 제작 스크립트와 샷 선택 JSON은 원본으로 남긴다. 모델과 가상환경은 필요한 작업에서만 별도로 준비한다. Instagram 운영 도구의 `instagram-assistant/pyproject.toml`과 `uv.lock`은 별개다.

## 1. 원본과 작업 폴더

저장소 루트에서 작업한다. `.cache/runway-walk/`는 Git에서 제외되어 있다.

```sh
mkdir -p .cache/runway-walk
uv venv --python 3.11 .cache/runway-walk/.venv
```

- 영상 URL, 로컬 파일명, 원본 fps, 시작 오프셋, 저해상도 포즈 영상과 원본 사이의 크기 비율은 [`angle-sources.json`](../../../scripts/runway-walk/angle-sources.json)에 있다. 각 `file`과 `poseFile`을 캐시 바로 아래에 준비한다.
- [`angle-shots.json`](../../../scripts/runway-walk/angle-shots.json)은 선택 구간·ROI·인물 선택·관절 보정·가림·제외 프레임 등 수동 검토 결과다. 영상을 임의로 앞뒤에서 자르면 이 프레임 번호와 맞지 않는다. 파일별 fps와 오프셋을 유지한다.
- MediaPipe Pose Landmarker 모델을 캐시의 `pose.task`로 준비한다. 현재 배포 데이터의 `quality.headSupportModelSha256`은 `4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad`다. 모델을 교체하면 포즈 검출 결과도 다시 검토한다.
- 여러 방향을 만드는 절차는 아래 `angles.py`부터 시작한다. 사용하지 않는 최초 전면 추출기 `extract.py`, 초기 합성 모듈 `core.py`, 초기 발 접촉 목록 `footfalls.json`은 정리했다. 초기 실험을 조사할 때만 Git의 `9013100f`에서 해당 파일을 확인한다.

## 2. 필요한 패키지만 임시 설치

다음은 의존성 정리 전 제작 도구의 버전 기록이다. 2026-11-03의 문서화 작업에서 전체 영상 재추출이나 이 환경의 재설치를 수행하지 않았다. 향후 재제작 시 설치 가능 여부와 모델 호환성을 확인하고 결과를 원본과 비교한다.

| 용도 | 패키지 기록 |
| --- | --- |
| 포즈·배열·필터·사진 | `mediapipe==1.1.1`, `numpy==2.4.6`, `scipy==1.17.1`, `Pillow==13.0.0` |
| OpenCV | 스크립트의 `cv2`는 MediaPipe가 요구하는 `opencv-contrib-python`으로 제공된다. 별도 OpenCV 배포판을 겹쳐 설치하지 않는다. |
| Apple MPS 추론 | `torch==2.9.1`, `torchvision==0.24.1`, `timm==1.0.22`, `transformers==4.57.6`, `safetensors==0.6.2`, `huggingface-hub==0.36.0`, `kornia==0.8.2`, `einops==0.8.1` |
| 선택적 ONNX 매팅 | `onnxruntime==1.31.0`과 별도의 BiRefNet ONNX 모델 |
| 파일 변환 | 영상 변환에 FFmpeg, `encode-avif.py`에 `avifenc` 실행 파일 |

예를 들어 기존 MPS 경로를 복원할 때만 다음과 같이 설치한다.

```sh
uv pip install --python .cache/runway-walk/.venv/bin/python \
  mediapipe==1.1.1 numpy==2.4.6 scipy==1.17.1 Pillow==13.0.0 \
  torch==2.9.1 torchvision==0.24.1 timm==1.0.22 \
  transformers==4.57.6 safetensors==0.6.2 huggingface-hub==0.36.0 \
  kornia==0.8.2 einops==0.8.1
```

`kornia`와 `einops`는 저장소 스크립트에 직접 import가 없어도 다운로드한 BiRefNet 코드에서 사용한다. `torchvision`과 `torch`는 서로 맞는 조합이어야 한다. PR #114의 `torch==2.13.0`만 기존 `torchvision==0.24.1`과 섞으면 설치 조건이 충돌한다. PR #113의 `transformers==5.10.1`도 `huggingface-hub>=1.5.0,<2.0`을 요구해 기존 `0.36.0`과 함께 설치할 수 없다. 이 업데이트들은 재제작 검증 완료를 뜻하지 않으며, 활성 의존성 파일은 유지하지 않는다.

## 3. 모델 준비

```sh
.cache/runway-walk/.venv/bin/python scripts/runway-walk/prepare-matting.py \
  --cache .cache/runway-walk
.cache/runway-walk/.venv/bin/python scripts/runway-walk/prepare-instance.py \
  --cache .cache/runway-walk
```

- `prepare-matting.py`는 `ZhengPeng7/BiRefNet_lite`의 revision `aa62cd87eafb9cc43056d08ef3615a14628b831d`를 `birefnet-torch/`에 받으며, 코드·설정·가중치의 SHA-256을 검사한다.
- `prepare-instance.py`는 `facebook/sam2.1-hiera-tiny`의 revision `de431c4043854a71d8101e17995dfe596bf101a5`를 `sam2-tiny/`에 받고 파일별 체크섬을 확인한다. 샷의 instance 지원에 사용한다.
- `matting.py`의 MPS 경로는 위 고정 BiRefNet 코드를 로컬에서 불러온다. ONNX를 선택한다면 `birefnet-lite.onnx`를 별도로 준비해야 한다. `prepare-matting.py`가 ONNX 파일까지 받지는 않는다. ONNX 경로에서도 instance 지원을 쓰는 샷은 SAM2와 PyTorch 계열 패키지가 필요하다.

## 4. 추출과 정렬

라이브 파일을 덮어쓰기 전에 `.cache/runway-walk/rebuild/`에서 생성·검토한다.

```sh
mkdir -p .cache/runway-walk/rebuild
.cache/runway-walk/.venv/bin/python scripts/runway-walk/angles.py \
  --cache .cache/runway-walk --output .cache/runway-walk/rebuild --manifest-only
.cache/runway-walk/.venv/bin/python scripts/runway-walk/refine-angles.py \
  --cache .cache/runway-walk --output .cache/runway-walk/rebuild --engine mps
.cache/runway-walk/.venv/bin/python scripts/runway-walk/debug-poses.py \
  --cache .cache/runway-walk --output .cache/runway-walk/rebuild
```

`angles.py`는 선택된 샷의 포즈와 프레임 목록을 만든다. `refine-angles.py`는 원본 해상도로 매팅하고 인물·소품·가림 조건을 적용한 뒤 512×768 타일을 WebP atlas에 배치한다. `debug-poses.py`는 같은 사진 좌표계에 33개 관절을 등록하고 `angles.json`의 posture와 `debug-poses.json`을 갱신한다.

현재 배포본에는 추출 후 수동 매팅 보정도 있다. `pages/runway-walk/angles.json`의 `quality.matteRepairs`에 구간과 방식이 기록되어 있다. 기본 추출 스크립트 실행만으로 이 최종 보정까지 자동 재현된다고 가정하지 않는다.

## 5. 배포 사진과 재생 일정

- `restore-originals.py`는 Git의 `c8d352ef`에서 보정 전 사진을 `assets/quality-original/`로 복원하는 보조 도구다. 해당 Git 객체와 같은 `assetVersion`의 manifest가 필요하다.
- `compress-quality.py`는 `assets/quality/` 사진과 manifest를 직접 갱신하는 일회성 WebP 최적화다. 이미지 크기와 alpha가 유지되는지 검사한다.
- `encode-avif.py`는 `assets/quality/`에서 `assets/quality-avif/` 배포본을 만든다. 기본 크기는 640×960이며 AVIF와 WebP fallback을 함께 만든다. `--source-ref`와 `--cleanup-ref`로 원본 Git 버전을 지정할 수 있다. 이미 손실 압축한 사진을 새 원본으로 반복 압축하지 않는다.
- 이 세 스크립트는 출력 경로가 `pages/runway-walk/`로 고정되어 있으므로 별도 checkout에서 실행하고 diff를 확인한다. 추출 결과와 배포용 개별 사진 선택 사이에는 수동 편집이 있으며, 현재 선택은 `assets/quality/manifest.json`과 관련 provenance를 기준으로 비교한다.
- 검토한 추출 결과를 실제 페이지에 반영한 뒤 `node scripts/runway-walk/build-schedule.mjs pages/runway-walk .cache/runway-walk/candidate-schedule.json`으로 재생 일정 후보를 별도 출력한다. 현재 live 일정에는 더 강한 수동 검토 표시인 `boundaryReview`가 있어 직접 덮어쓰기가 차단된다. 후보를 생성하는 것만으로 현재 편집과 동등한 검증이 끝나는 것은 아니며, 전체 사진·동작·실제 재생 검토 후 교체한다.

## 6. 검증과 종료

원본 인물·의상·머리·손·신발·소품이 보존됐는지 프레임별로 확인한다. 방향별 재생, 발 접촉, 관절 등록, 반복 구간과 전환도 기존 Chrome에서 확인한다. atlas, 사진 manifest, `angles.json`, `debug-poses.json`, 재생 일정의 프레임과 버전이 서로 맞아야 한다.

```sh
pnpm test pages/runway-walk scripts/runway-walk
pnpm check:runway-motion
pnpm typecheck
pnpm build
```

검증 후 필요한 생성물만 반영한다. 원본 영상, 모델, 임시 가상환경과 비교 결과는 커밋하지 않는다. 임시 제작 환경이 더 필요 없으면 `.cache/runway-walk/.venv`를 삭제해 설치했던 AI 패키지도 함께 제거한다.
