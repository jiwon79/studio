# Runway Walk

루이비통 쇼의 실제 프레임에서 인물만 분리하고, 걸음의 위상을 맞춰 인물을 교체하는 시안 모음. `/runway-walk/`의 기본 화면은 원본 배경을 남긴 3프레임 사각 크롭이다. 같은 프레임의 누끼 버전과 나란히 비교할 수 있다. `/runway-walk/angle.html`은 인물과 숫자 각도만 표시한다. 화면 어디서든 좌우로 드래그해 방향을 바꾸고, 터치 중에는 공통 터치 포인터를 표시한다. 방향은 이 브라우저에 저장하며 새로고침 뒤 복원한다. 키보드는 좌우 방향키로 5°, Shift와 함께 1°씩 조절하고 Home으로 정면, Space로 재생·정지한다. 화면의 설명·출처·저장 버튼·슬라이더는 제거하고 보조기술용 방향 값과 상태만 유지한다.

루이비통 SS27, [Prada SS26](https://www.youtube.com/watch?v=SAjtxnyXu8U), [Prada SS25](https://www.youtube.com/watch?v=vz6dKkEiJzg), [Prada SS24](https://www.youtube.com/watch?v=BGWhB8dOKhc), [Fendi SS25](https://www.youtube.com/watch?v=TSzy2vbjTac), [Gucci SS25](https://www.youtube.com/watch?v=4kD2CrWB_6k), [Hermès SS26](https://www.youtube.com/watch?v=eQUau2GefuA), [Hermès Summer 2024](https://www.youtube.com/watch?v=cN12oPqe3Qc), [Hermès Summer 2025](https://www.youtube.com/watch?v=cZdY5tQkNIo)의 실제 프레임을 사용한다. 현재 소지품이 없는 74개 구간·65착장·2502프레임을 사용한다. HD 출력은 512×768 투명 타일, 네 프레임씩 묶은 626장의 WebP 아틀라스이며 총 75.77 MB다. 같은 착장의 다른 구간은 `lookId`로 묶는다. 배경은 따뜻한 회색이며 원래 의상 색은 유지한다.

방향 화면에서는 손에 든 가방·토트·클러치와 크로스백이 있는 착장을 구간 전체로 제외한다. 의상에 걸쳐진 가방을 알파에서 지워 팔·옷의 빈 부분을 만들지 않는다. `angle-shots.json`의 `carriedItems: "none"`은 소지품이 없는 구간의 검토 표시이며, 추출기는 표시가 없는 구간을 거부한다. 모자·신발·안경 등 착용한 의상은 유지한다. 가방 착장 44구간과 팔 옆이나 코트 밑단에 관객 잔여가 붙은 두 구간을 제외하고, 기존 구간의 깨끗한 부분을 연장하고 Hermès의 소지품 없는 구간을 보충했다. 카메라가 높아 체형과 수직 방향이 달라 보이는 두 구간은 제외한다. 관객의 머리·팔이나 우산이 붙은 프레임은 `excludedFrames`·`reviewedFrames`로 제한하고, 원본에서 확인한 세 프레임의 좌우 다리 감지 오류는 `poseXYOverrides`로 바로잡는다. 기존 정면 자료 중 소지품 없는 4구간·111프레임은 유지한다. 이전 MP4 비교 시안은 별도 자료다.

`angle-shots.json`의 방향은 화면을 보고 붙인 카메라 기준 근사값이다. 선택 범위는 −90°부터 +90°까지다. `yawKeys`를 기준으로 어깨·골반의 상대 회전을 제한적으로 반영한다. 머리 방향이나 화면 이동만으로 몸통 방향을 정하지 않는다. 뒤쪽으로 돌아선 프레임은 원래의 90° 밖 각도를 보관한다. 좌우 반전이나 생성 프레임을 사용하지 않는다.

아래는 선택한 방향에서 연속 3프레임 재생이 가능한 후보 수다. 세 프레임 모두 선택 각도의 절대 ±5° 안에 있어야 한다. 겹치는 블록의 원본 프레임은 한 번만, 같은 착장의 재등장도 한 착장으로 센다. 소지품 제외 후 181개 방향의 최소치는 **53프레임·7착장**이다. 이전의 모든 방향 100프레임 조건은 유지되지 않으며, 방향 오차나 누끼 기준을 완화해 채우지 않는다. 오른쪽 86°는 7착장이고, 나머지 180개 방향은 8착장 이상이다. 실제 보행 선택에는 위상·관절·속도 조건이 추가되므로 후보 전체가 항상 재생되지는 않는다.

| 선택 방향 | 착장 후보 | 실제 프레임 후보 |
| --- | ---: | ---: |
| 왼쪽 90° | 12 | 90 |
| 왼쪽 75° | 10 | 75 |
| 왼쪽 60° | 12 | 61 |
| 왼쪽 45° | 13 | 95 |
| 왼쪽 30° | 14 | 129 |
| 왼쪽 15° | 17 | 233 |
| 정면 | 14 | 219 |
| 오른쪽 15° | 14 | 135 |
| 오른쪽 30° | 13 | 69 |
| 오른쪽 45° | 16 | 113 |
| 오른쪽 60° | 14 | 93 |
| 오른쪽 75° | 13 | 97 |
| 오른쪽 90° | 9 | 71 |

보행 위상은 MediaPipe 3D 발목 차이를 몸의 앞 방향에 투영하고 주기 함수를 맞춰 추정한다. 얕은 사선은 가방 없는 정면 기준 `prada25-look-50`의 다리 움직임과 위상을 맞춘다. 짧은 피날레는 검토에서 남은 한 사람의 관절만으로 `phaseReference`의 주기와 비교한다. 직전 인물의 무릎·발목 위치와 속도로 다음 위치를 예상하고, 위상과 관절 위치·속도가 가까운 후보를 고른다. 조건이 가까운 후보 중 최근 네 착장을 피한다. 한 구간에서는 실제 연속 3프레임을 순서대로 보여준다.

카메라 컷은 원본 RGB 변화로 분리하고, 한 쇼트 안의 전신 자세만 사용한다. [BiRefNet lite](https://huggingface.co/ZhengPeng7/BiRefNet_lite)가 각 1080p 원본 프레임의 알파를 직접 계산하고, 군중 구간은 [SAM2.1 tiny](https://huggingface.co/facebook/sam2.1-hiera-tiny)의 인물 지지 영역으로 다른 모델·관객을 제외한다. 보이는 머리·팔·무릎·발목이 사라지거나 원본 크롭 가장자리에 닿는 프레임은 제외한다. 필요한 구간에는 `reviewedFrames`, `excludedFrames`, 머리 영역과 지지 마스크 임계값을 기록한다. 얼굴·의상·가려진 신체를 생성하거나 원본 RGB를 섞지 않는다. 자동 마스크의 작은 테두리 오차와 원본 촬영 해상도의 한계는 남는다.

크기는 굽힌 다리 길이 대신 알파의 머리 끝부터 발바닥까지로 맞춘다. 전신 높이 660px, 바닥 720px를 기준으로 골반 가로 위치를 안정화하고 타일 폭을 넘는 확대는 제한한다. 가로세로 비율과 실제 체형을 유지한다. 알파를 곱한 상태에서 리샘플링해 경계 번짐을 줄인다. 감지기가 신발 옆 배경이나 다리 사이를 잡은 관절은 원본과 확인한 `poseXYOverrides`로 보정하고, 완전성 검사는 완화하지 않는다.

드래그 중에는 모든 각도·여덟 보행 위상에 해당하는 작은 원본 프레임을 먼저 메모리에 준비해 네트워크 요청·디코딩 없이 그린다. `drag.json`은 HD 매니페스트와 같은 원본의 433프레임을 160×240 타일·10페이지에 보관한다. 전송량은 3.07 MB, 디코딩 픽셀은 73.73 MB다. 드래그 동안 경량 프레임을 사용하고 손을 놓으면 같은 방향의 512×768 HD 구간으로 복귀한다. 숫자와 인물은 함께 갱신하며 드래그 중에도 경량 보행을 계속 그린다. 각도 후보 풀은 재사용하므로 포인터 이동마다 전체 자료를 검색하지 않는다.

HD 사진과 드래그 프리뷰를 모두 내려받은 뒤 재생과 입력을 시작한다. 준비 중에는 글자 대신 작은 진행 링을 표시한다. HD 압축 Blob 전체를 보관하며 재생 중 추가 네트워크 요청은 없다. 현재 구간과 다음 세 구간을 미리 디코딩하고, 프레임 교체는 동기적으로 처리한다. 준비가 늦으면 보행 시계도 함께 기다려 이미지와 걸음 위상이 따로 진행하지 않는다. 방향 변경 중에는 상주 프리뷰를 표시하고 새 방향의 첫 네 구간이 준비되면 HD로 전환한다.

HD ImageBitmap은 12장까지 보관하고 오래된 페이지는 `close()`로 해제한다. 현재와 예정된 구간은 퇴출하지 않는다. HD 디코딩 픽셀은 약 75.5 MB이며 상주 프리뷰·전체 압축 Blob·Canvas 메모리는 별도다. 모든 HD 사진을 디코딩해 수 GB를 상주시키는 방식은 사용하지 않는다. 같은 착장의 3프레임 구간을 즉시 반복 선택하지 않아 발이 되감기는 것을 막고, 무릎·발목 좌표가 한 프레임에 화면 폭·높이의 12% 넘게 뛰는 블록은 보행 후보에서 제외한다.

- `angles.json`: 출처, 구간·착장 ID, 원본 프레임, 근사 방향, 보행 위상·관절과 HD 아틀라스 인덱스.
- `drag.json`, `scripts/runway-walk/drag-previews.py`: 최종 HD 자료와 버전이 일치하는 드래그용 프리뷰와 각도·위상 인덱스.
- `scripts/runway-walk/angle-sources.json`: 원본 URL, 로컬 파일, 원본·정규화 fps와 시작 오프셋. 원본 시각은 `sourceOffset + sourceFrame / fps`다.
- `angle-match.ts`: 연속 구간·방향 검증과 보행 선택. 테스트는 181개 방향의 절대 오차, 연속성, 착장 다양성, 소지품 구간 제외와 프리뷰 버전·메모리 상한을 검사한다.
- `angle.ts`, `atlas-pool.ts`: 입력, 사진 선로딩·재생 버퍼, Canvas와 HD 페이지 수명 관리.
- `body_yaw.py`: 검토한 방향 기준과 어깨·골반의 상대 회전을 결합한 프레임별 보간.
- `refine-angles.py`, `matting.py`, `instance.py`: 프레임별 마스크, 인물 분리·전신 검증, 신장 보정과 출력. 원본·모델·중간 마스크·PNG는 Git 제외 캐시에 둔다.

추가 소스를 로컬 캐시에 받은 뒤 재현한다. 원본 영상과 모델은 Git에 포함하지 않는다. 아래 실행 전 기본 원본·MediaPipe 모델·가상환경은 다음 절의 절차로 준비한다.

```sh
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 136 -o .cache/runway-walk/prada-ss26.mp4 'https://www.youtube.com/watch?v=SAjtxnyXu8U'
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 137 -o .cache/runway-walk/prada-ss26-hd.mp4 'https://www.youtube.com/watch?v=SAjtxnyXu8U'
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 'bestvideo[height=1080][ext=mp4]/bestvideo[height=1080]' -o .cache/runway-walk/prada-ss24-original.mp4 'https://www.youtube.com/watch?v=BGWhB8dOKhc'
ffmpeg -i .cache/runway-walk/prada-ss24-original.mp4 -vf fps=25 -c:v libx264 -preset veryfast -crf 15 -an .cache/runway-walk/prada-ss24.mp4
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 'bestvideo[height=1080][ext=mp4]/bestvideo[height=1080]/bestvideo[height<=1080]' -o .cache/runway-walk/prada-ss25-original.mp4 'https://www.youtube.com/watch?v=vz6dKkEiJzg'
ffmpeg -i .cache/runway-walk/prada-ss25-original.mp4 -vf fps=25 -c:v libx264 -preset veryfast -crf 15 -an .cache/runway-walk/prada-ss25.mp4
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 137 -o .cache/runway-walk/fendi-ss25.mp4 'https://www.youtube.com/watch?v=TSzy2vbjTac'
ffmpeg -ss 1690 -i .cache/runway-walk/fendi-ss25.mp4 -t 635 -vf fps=25 -c:v libx264 -preset veryfast -crf 15 -an .cache/runway-walk/fendi-ss25-show.mp4
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 'bestvideo[height=1080][ext=mp4]/bestvideo[height=1080]' -o .cache/runway-walk/gucci-ss25-original.mp4 'https://www.youtube.com/watch?v=4kD2CrWB_6k'
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 'bestvideo[height=1080][ext=mp4]/bestvideo[height=1080]' -o .cache/runway-walk/hermes-ss26-original.mp4 'https://www.youtube.com/watch?v=eQUau2GefuA'
ffmpeg -i .cache/runway-walk/hermes-ss26-original.mp4 -vf fps=25 -c:v libx264 -preset veryfast -crf 15 -an .cache/runway-walk/hermes-ss26.mp4
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 'bestvideo[height=1080][ext=mp4]/bestvideo[height=1080]' -o .cache/runway-walk/hermes-ss24-original.mp4 'https://www.youtube.com/watch?v=cN12oPqe3Qc'
ffmpeg -i .cache/runway-walk/hermes-ss24-original.mp4 -vf fps=25 -c:v libx264 -preset veryfast -crf 15 -an .cache/runway-walk/hermes-ss24.mp4
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 'bestvideo[height=1080][ext=mp4]/bestvideo[height=1080]' -o .cache/runway-walk/hermes-ss25-original.mp4 'https://www.youtube.com/watch?v=cZdY5tQkNIo'
ffmpeg -i .cache/runway-walk/hermes-ss25-original.mp4 -vf fps=25 -c:v libx264 -preset veryfast -crf 15 -an .cache/runway-walk/hermes-ss25.mp4
curl -fL 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx' -o .cache/runway-walk/birefnet-lite.onnx

# Apple Silicon: 프레임별 추론 가속 (공식 고정 리비전, 로컬 실행)
uv pip install --python .cache/runway-walk/venv/bin/python -r scripts/runway-walk/requirements-mps.txt
.cache/runway-walk/venv/bin/python scripts/runway-walk/prepare-matting.py --cache .cache/runway-walk
.cache/runway-walk/venv/bin/python scripts/runway-walk/prepare-instance.py --cache .cache/runway-walk
.cache/runway-walk/venv/bin/python scripts/runway-walk/angles.py --cache .cache/runway-walk --output .cache/runway-walk/export --manifest-only
.cache/runway-walk/venv/bin/python scripts/runway-walk/refine-angles.py --cache .cache/runway-walk --output .cache/runway-walk/export --engine mps
.cache/runway-walk/venv/bin/python scripts/runway-walk/drag-previews.py --output .cache/runway-walk/export
```

위 명령은 Git 제외 스테이징에 출력한다. 원본·누끼·재생을 확인한 다음 `angles.json`·`drag.json`과 두 매니페스트에 나열된 아틀라스만 `pages/runway-walk/`에 반영한다. 인물별 분리를 사용하는 현재 자료는 `requirements-mps.txt`의 PyTorch·Transformers가 필요하며, CPU로 실행하려면 마지막 명령의 `--engine onnx`를 사용할 수 있다.

## 다시 만들기

Python 3.11+, FFmpeg, uv, 최신 yt-dlp가 필요하다. 원본, 모델, 인물 PNG 캐시는 Git에 포함하지 않는다. 반복 조정을 위해 `.cache/runway-walk/`에 로컬로 보관한다. 캐시가 있으면 내려받기·추출을 건너뛰고 합성 단계만 실행할 수 있다. 검증용 비교 자료와 임시 분석 스크립트는 별도 `.qa/`에서 만들고 제거한다.

```sh
mkdir -p .cache/runway-walk
uv venv --python 3.11 .cache/runway-walk/venv
uv pip install --python .cache/runway-walk/venv/bin/python -r scripts/runway-walk/requirements.txt
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 137 -o .cache/runway-walk/source.mp4 'https://www.youtube.com/watch?v=qcE5NeDUvIk'
curl -fLs 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task' -o .cache/runway-walk/pose.task
.cache/runway-walk/venv/bin/python scripts/runway-walk/extract.py --source .cache/runway-walk/source.mp4 --pose-model .cache/runway-walk/pose.task --cache .cache/runway-walk/clips
.cache/runway-walk/venv/bin/python scripts/runway-walk/compose.py --cache .cache/runway-walk/clips --output pages/runway-walk
.cache/runway-walk/venv/bin/python scripts/runway-walk/extract.py --source .cache/runway-walk/source.mp4 --pose-model .cache/runway-walk/pose.task --cache .cache/runway-walk/clips --footfalls scripts/runway-walk/footfalls.json
.cache/runway-walk/venv/bin/python scripts/runway-walk/variants.py --cache .cache/runway-walk/clips --output pages/runway-walk
.cache/runway-walk/venv/bin/python scripts/runway-walk/color-cadence.py --cache .cache/runway-walk/clips --output pages/runway-walk
.cache/runway-walk/venv/bin/python scripts/runway-walk/rectangle.py --source .cache/runway-walk/source.mp4 --cache .cache/runway-walk/clips --output pages/runway-walk
ffmpeg -hide_banner -loglevel error -y -i pages/runway-walk/media/runway-frame.mp4 -filter_complex '[0:v]scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 pages/runway-walk/media/preview.gif
ffmpeg -hide_banner -loglevel error -y -i pages/runway-walk/media/runway-color.mp4 -i pages/runway-walk/media/runway-footfall.mp4 -filter_complex '[0:v]scale=256:384:flags=lanczos[a];[1:v]scale=256:384:flags=lanczos[b];[a][b]hstack,split[c][d];[c]palettegen=stats_mode=diff[p];[d][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 pages/runway-walk/media/compare.gif
ffmpeg -hide_banner -loglevel error -y -i pages/runway-walk/media/runway-color-cadence.mp4 -filter_complex '[0:v]scale=360:540:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 pages/runway-walk/media/color-cadence.gif
ffmpeg -hide_banner -loglevel error -y -i pages/runway-walk/media/runway-color-3.mp4 -i pages/runway-walk/media/runway-color-3-rectangle.mp4 -filter_complex '[0:v]scale=256:384:flags=lanczos[a];[1:v]scale=256:384:flags=lanczos[b];[a][b]hstack,split[c][d];[c]palettegen=max_colors=128:stats_mode=diff[p];[d][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 pages/runway-walk/media/rectangle-compare.gif
```

쇼의 정면 카메라 구간 27개를 지정한 처리기다. 다른 영상에 그대로 적용하는 범용 탐지기는 아니다. 중앙 ROI에서 MediaPipe로 신체 좌표와 마스크를 얻고, 전신이 보이는 프레임만 남긴다. 골반 위치와 다리 길이로 크기를 맞추며, 마스크의 골반 연결 성분을 남긴다. 리샘플링 전에 알파를 곱해 배경색의 가장자리 번짐을 줄인다.

좌우 발목 높이 차이에 주기 함수를 맞춰 보행 위상과 방향을 추정한다. 파란 스웨터 구간(276초)의 보행을 기준으로 무릎·발목·발 모양과 이전 자세의 차이를 함께 비교한다. 30프레임 주기를 여섯 번 진행하며 최근 사용한 인물은 잠시 제외한다. 얼굴이나 의상을 생성하거나 몸을 변형하지 않는다.

자동 마스크라 머리카락·가방·발 주변에 약한 테두리나 누락이 남는다. 사람마다 보폭과 팔 동작이 달라 자세가 완전히 일치하지는 않는다. 3프레임 버전은 선택한 구간 안에서 원본 프레임이 실제로 연속되는지 검사한다. 프레임 교체와 마스크의 최종 판단은 실제 재생 화면으로 한다.

## 두 가지 추가 시안

색 버전은 의상 색을 보고 정한 인물 순서의 가까운 세 후보 안에서 걸음이 맞는 프레임을 고른다. 골반과 다리 길이의 정렬은 기존 시안과 공유한다. 빠른 인물 교체 안에 큰 색의 흐름이 생기도록 한 편집 규칙이며, 색을 다시 칠하거나 인물 사이를 겹쳐 녹이지 않는다.

발 디딤 버전은 자동 주기 추정만으로 컷을 정하지 않는다. `scripts/runway-walk/footfalls.json`에 원본 신발과 바닥의 접촉을 직접 확인한 시작·끝 프레임을 기록했다. `foot`은 화면 방향이 아닌 사람의 왼발·오른발이다. 시작부터 다음 반대 발 접촉 직전까지 원본의 순서를 유지하며, 한 구간을 15프레임(0.6초)으로 맞춰 중복 또는 생략 샘플링한다. 각 컷에서는 좌우 발이 번갈아 닿는다. 바닥 높이 차이를 줄이기 위해 인물 전체의 세로 위치도 맞춘다.

일부 프레임은 가려진 관절의 신뢰도가 낮아 첫 추출에서 빠졌다. 수동으로 확인한 발 디딤 구간만 다시 추출해 `poses-contact.json`에 보관하며, 기존 `poses.json`과 분리한다. 배경 사람과 겹치는 검은 가죽 재킷 구간(800초)은 새 두 버전에서 제외했다. 접촉 시점은 25fps 영상에서의 시각적 판단이므로 정밀한 보행 측정값은 아니다.
