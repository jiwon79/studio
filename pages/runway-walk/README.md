# Runway Walk

루이비통 쇼의 실제 프레임에서 인물만 분리하고, 걸음의 위상을 맞춰 인물을 교체하는 시안 모음. `/runway-walk/`의 기본 화면은 원본 배경을 남긴 3프레임 사각 크롭이다. 같은 프레임의 누끼 버전과 나란히 비교할 수 있다. `/runway-walk/angle.html`에는 방향을 고르는 인터랙티브 시안이 있다. 이전 색 흐름과 발 디딤 버전도 선택할 수 있다. 두 영상을 함께 일시정지하고 한 프레임씩 이동할 수 있다. 갤러리 인덱스에는 추가하지 않았다.

- 원본: [Men’s Spring-Summer 2027 Show | LOUIS VUITTON](https://www.youtube.com/watch?v=qcE5NeDUvIk), 1920×1080 / 25fps.
- 결과: 720×1080, 25fps, 180프레임, 7.2초, 무음.
- `media/runway-frame.mp4`: 매 프레임 인물 교체, 19명.
- `media/runway-step.mp4`: 실제 연속 3프레임을 유지한 뒤 교체, 12명.
- `manifest.json`: 원본, 후보 구간, 출력 규격. `edits.json`: 각 출력 프레임의 원본 프레임 번호와 인물 구간 ID. 구간 ID는 원본 영상의 초 단위 위치이며, 사람의 신원을 뜻하지 않는다.
- `media/preview.gif`: 기존 매 프레임 버전의 축소 미리보기.
- `media/runway-color.mp4`: 원래 의상 색이 어두운색 → 파랑·보라 → 밝은색 → 노랑·주황 → 빨강 → 어두운색으로 흐르는 24명 버전. 의상 색은 변경하지 않는다.
- `media/runway-footfall.mp4`: 한 발을 디딘 순간부터 반대 발을 디디기 직전까지 같은 사람을 유지하는 12명 버전.
- `media/compare.gif`: 왼쪽 색의 흐름 / 오른쪽 발 디딤을 함께 보는 축소 미리보기.
- `variants.json`, `variant-edits.json`: 두 버전의 설정, 발 디딤 표시, 출력 프레임별 원본 위치.

색 흐름의 전환 속도 비교는 `?mode=cadence`, 개별 버전은 `?mode=color3`, `?mode=color4`, `?mode=color5`, `?mode=color6`로 연다. 네 영상 모두 같은 색 진행과 보행 주기의 7.2초 루프다. 6프레임 버전은 23명, 나머지는 24명이 사용됐다. 구간 길이에 맞는 연속 원본 프레임을 고르므로 버전별 인물 선택은 조금씩 다르다.

- `media/runway-color-{3,4,5,6}.mp4`: 같은 인물을 각각 3·4·5·6프레임 유지한다. 구간 안에서는 원본 프레임을 하나씩 진행시킨다.
- `media/runway-color-cadence.mp4`, `media/color-cadence.gif`: 위 3·4프레임 / 아래 5·6프레임의 2×2 비교. 간격 라벨은 비교본에만 표시한다.
- `color-cadence.json`, `color-cadence-edits.json`: 전환 간격·인물 수와 출력 프레임별 원본 위치.

이전 개별 미리보기는 `?mode=color`, `?mode=footfall`, 두 작품 나란히 보기는 `?mode=compare`로 열 수 있다. 기존 `frame`, `step` 버전도 같은 화면에서 선택한다.

## 선택한 3프레임 사각 크롭

- `media/runway-color-3-rectangle.mp4`: 원래의 무대·배경을 남긴 세로 사각형 영상. 720×1080, 25fps, 180프레임, 7.2초.
- `media/rectangle-compare.gif`: 왼쪽 누끼 / 오른쪽 사각 크롭의 축소 비교.
- `rectangle.json`: 기존 3프레임 버전과 동일한 인물·원본 프레임 순서, 각 프레임의 원본 크롭 범위와 픽셀 검증 결과.

`?mode=rectangle`은 사각 크롭, `?mode=color3`는 누끼, `?mode=cropCompare`는 동기화 비교다. 기존 전환 간격 비교는 이전 시안에 보존한다.

누끼 버전의 알파 마스크를 사용하지 않고 원본 프레임의 사각 영역을 리샘플링한다. 골반 위치와 다리 길이를 기준으로 잡은 구도가 원본 테두리를 넘으면, 원본 안으로 크롭을 이동하거나 확대한다. 빈 배경을 만들지 않기 때문에 일부 프레임의 인물 크기·위치는 누끼 버전과 조금 다르다. 추출 캐시의 RGB와 원본 영상의 픽셀이 일치하는지 180프레임 모두 확인한 뒤 출력한다.

## 몸의 방향을 고르는 인터랙티브 시안

`/runway-walk/angle.html`에서 인물을 좌우로 드래그하거나 방향 슬라이더·방향키로 몸의 방향을 고른다. 손을 놓으면 선택 방향을 유지한다. `이 방향 저장 +`는 최대 다섯 방향을 이 브라우저의 로컬 저장소에 보관하며, 다시 눌러 불러올 수 있다. 선택 방향도 새로고침 뒤 복원한다. 저장소를 사용할 수 없어도 조작과 재생은 동작한다.

루이비통 SS27, [Prada SS26](https://www.youtube.com/watch?v=SAjtxnyXu8U), [Prada SS25](https://www.youtube.com/watch?v=vz6dKkEiJzg), [Prada SS24](https://www.youtube.com/watch?v=BGWhB8dOKhc), [Fendi SS25](https://www.youtube.com/watch?v=TSzy2vbjTac), [Gucci SS25](https://www.youtube.com/watch?v=4kD2CrWB_6k), [Hermès SS26](https://www.youtube.com/watch?v=eQUau2GefuA)의 실제 프레임을 사용한다. 현재 67개 구간·59착장의 1800프레임을 512×768 투명 타일, 네 프레임씩 묶은 450장의 WebP 아틀라스에 보관한다. 미디어 전송량은 56.87 MB다. 같은 착장의 다른 구간은 `lookId`로 묶는다. 배경은 따뜻한 회색이며 원래 의상 색은 유지한다.

`angle-shots.json`의 방향은 화면을 직접 보고 붙인 카메라 기준 근사값이다. 회전 구간은 확인한 시점 사이를 `yawKeys`로 보간하며, 선택 범위는 약 왼쪽 75°부터 정면까지다. 좌우 반전이나 생성 프레임을 사용하지 않는다. 정면은 334프레임·10착장을 유지한다. 뒤의 모델이 붙던 Gucci 구간과 Fendi의 11프레임을 제외한 상태로, 부족한 방향에 Prada SS24의 회전 구간과 Hermès의 사선 구간을 보충했다. 반사로 몸이 왜곡되거나 다른 인물로 추적이 넘어간 프레임, 보라색 가방이 불안정하게 잘리는 구간은 제외했다.

아래는 이전의 단일 방향 태그 집계와 달리, **선택한 방향에서 실제 연속 3프레임 재생이 가능한 후보**를 센 수치다. 세 프레임 전체의 최대 방향 오차를 비교하고, 그중 최소 오차 + 5° 범위를 사용한다. 겹치는 3프레임 블록의 원본 프레임은 한 번만 세고, 같은 착장이 다시 나타나도 한 착장으로 센다. 1° 간격의 76개 선택 방향 모두 100프레임·8착장 이상이며, 최소치는 122프레임·8착장이다. 화면에도 같은 후보 수를 표시한다. 위상·관절 조건을 추가 적용한 실제 재생에서는 이 후보 중 일부가 선택된다.

| 선택 방향 | 착장 후보 | 실제 프레임 후보 |
| --- | ---: | ---: |
| 정면 | 10 | 334 |
| 10° | 8 | 139 |
| 15° | 25 | 461 |
| 20° | 24 | 413 |
| 30° | 17 | 129 |
| 35° | 18 | 129 |
| 38° | 18 | 122 |
| 45° | 19 | 220 |
| 50° | 22 | 302 |
| 55° | 23 | 327 |
| 60° | 18 | 209 |
| 70° | 21 | 312 |
| 75° | 16 | 272 |

보행 위상은 MediaPipe의 3D 발목 차이를 몸의 앞 방향에 투영하고 주기 함수를 맞춰 추정한다. 정면 근처의 사선 구간은 기준 정면 보행의 좌우 무릎·발목 차이와 비교해 위상 시작점을 추가 보정한다. 짧은 Hermès·Prada 회전 구간은 검토에서 남은 인물의 관절만으로 가까운 LV 사선 보행 한 주기에 주파수와 위상 시작점을 맞춘다. 다른 사람이 섞인 원시 검출 구간의 위상을 그대로 사용하지 않는다. 보행 시계는 방향과 독립적으로 계속 진행한다. 3프레임 경계마다 각 구간의 세 프레임에서 최소·최대 각도를 검사하고, 전체가 허용 방향 오차 안에 있는 구간만 후보로 삼는다. 회전 중인 구간의 대표 각도는 세 프레임의 평균이다. 직전 인물의 무릎·발목 위치와 이동 속도로 다음 프레임의 위치를 예상하고, 그 위치·이동 방향·보행 위상을 함께 비교한다. 비슷한 자세에서 발이 반대로 움직이는 컷의 우선순위를 낮춘다. 최적 비용과 가깝고 위상 차이도 작은 후보 중 최근 네 착장을 피한다. 선택한 구간에서는 원본의 실제 연속 3프레임을 순서대로 보여준다. 관절은 보정된 타일에서 실제로 그려지는 위치를 비교한다. 골반을 원점으로 빼면 사람마다 골반 높이가 달라지는 것을 놓치므로, 화면상의 무릎·발목 위치와 이동 방향을 직접 사용한다.

자세 감지가 신발 클로즈업을 전신으로 오인한 프레임이 있었다. 이제 지정 구간 안의 카메라 컷을 원본 RGB 변화로 따로 찾고, 전신 자세가 가장 많이 검출된 한 쇼트만 남긴다. 카메라가 바뀐 프레임을 같은 구간으로 연결하지 않는다. 회전 중인 짧은 구간도 수동으로 줄인다.

[BiRefNet lite](https://huggingface.co/ZhengPeng7/BiRefNet_lite)로 각 1080p 원본 프레임의 알파를 직접 계산한다. 이전 여섯 프레임 간격의 키 마스크와 optical flow는 가방 끈·발의 경계를 잘못 옮기는 경우가 있어 제거했다. 선택한 골반의 연결 성분과, 보이는 머리·팔다리·손 근처의 분리 성분을 유지한다. 가방처럼 큰 성분도 손 근처에서 지지를 받으면 보존한다. 발목 주변의 기하학적 제한으로 실제 신발이 잘리던 처리도 제거했다. 머리나 보이는 무릎·발목이 마스크에서 사라진 프레임은 제외한다.

Louis Vuitton의 파도 무늬가 머리에 붙는 현상은 현재 프레임의 MediaPipe 인물 마스크로 어깨 위 영역을 추가 제한한다. 새 Prada SS25의 가방 없는 네 구간은 관객의 손·다리가 인물에 붙는 것을 막기 위해 목 아래 영역에 이 제한을 적용하고 머리의 직접 마스크는 유지한다. 검은 코트 구간은 얼굴 위치를 기준으로 넉넉한 머리 영역을 추가 제한해 뒤쪽 관객의 머리가 붙는 것을 막는다. 청록색 셔츠 구간에서 손에 붙는 중립색 무대 테두리는 그 구간의 손 주변에서만 추가 제거한다. 관객의 손이 붙거나 머리 끝이 잘린 것으로 직접 확인한 프레임도 제외 목록에 기록한다. Prada의 흰 난간과 검은 무대 장식이 남던 두 구간도 전신 지지 마스크로 정리한다. Fendi의 겹침 구간에는 원본 ROI에서 직접 확인한 `matteRegion`을 적용한다. 이 영역은 누끼를 새로 그리지 않고 인물 바깥의 다른 모델만 제외하므로 실제 가방은 원시 알파 그대로 유지한다. 영역이 겹쳐 분리가 불확실한 프레임은 제외한다. 기존 MediaPipe의 전신 제한은 가방이 있는 구간에 적용하지 않는다. 원본 RGB를 섞거나 얼굴·옷을 생성하지 않는다. 자동 마스크의 작은 테두리 오차와 원본 촬영 해상도의 한계는 남는다.

새 Prada SS24와 추가 Hermès 구간은 [SAM2.1 tiny](https://huggingface.co/facebook/sam2.1-hiera-tiny)의 인물별 마스크로 다른 모델·관객을 분리한다. 실제로 보이는 얼굴·어깨·골반·팔·다리 좌표를 양성 지점으로 사용하며, 가방은 원본에서 확인한 별도 지점을 시간에 따라 보간해 함께 분리한다. 인물 마스크만으로 가방을 지우거나 배경을 채워 넣지 않는다. 경계의 부드러운 알파와 모든 RGB는 BiRefNet 및 촬영 원본에서 가져온다. 골반에 연결되지 않은 잔여 관객의 손은 제외하되, 명시한 가방 지점의 성분은 보존한다. 보이는 팔이 중간에 끊기거나 누끼가 원본 크롭 가장자리에 닿는 컷은 제외한다. 유리 반사, 인물 교체, 불안정한 가방 경계는 검토 목록으로 추가 제외한다. 모델·설정의 고정 리비전과 SHA-256은 `prepare-instance.py`에서 검증한다.

Apple Silicon에서는 공식 모델의 고정 리비전을 로컬에 내려받아 MPS로 처리한다. 다운로드 스크립트가 모델과 실행 코드의 SHA-256을 확인한다. ONNX CPU 실행도 선택할 수 있다. 마스크 캐시는 인물 선택 이전의 원시 알파를 보관하므로 정리 규칙을 바꿔도 가방이나 분리된 신체 영역을 다시 복구할 수 있다.

크기는 굽힌 다리의 2D 길이 대신 알파의 머리 끝부터 발바닥까지의 높이로 맞춘다. 각 프레임의 전신 높이를 660px, 발바닥을 720px로 맞춘다. 골반 가로 위치는 구간 안에서 안정화한다. 바닥 높이를 시간 방향으로 평균하면 발이 뜨므로 현재 프레임의 발바닥을 직접 기준으로 삼는다. 가방·모자·보폭이 타일을 벗어나면 확대를 제한한다. 가로세로 비율과 실제 체형은 유지한다. 알파를 곱한 상태에서 리샘플링해 투명 경계의 색 번짐을 줄인다.

브라우저는 압축 페이지를 최대 여섯 요청으로 읽고 ImageBitmap은 최대 다섯 페이지만 디코딩한다. 다음 구간을 미리 준비하고 오래된 페이지는 `close()`로 해제한다. 디코딩한 아틀라스 픽셀은 최대 약 31.5MB이며 압축 Blob·Canvas 메모리는 별도다. 이전 MP4 시안은 이 단계에서 변경하지 않는다.

- `angles.json`: 출처, 구간·착장 ID, 정규화 원본 프레임 번호, 근사 방향, 보행 위상, 관절·크기 보정 정보, 아틀라스 인덱스.
- `scripts/runway-walk/angle-sources.json`: 원본 URL, 로컬 파일, 원본·정규화 fps와 시작 오프셋. Prada SS25는 50fps, Fendi SS25는 30fps 원본을 25fps로 맞춘다. Fendi 캐시는 원본 1690초부터 635초 구간이다. 원본 시각은 `sourceOffset + sourceFrame / fps`로 복원한다.
- `angle-match.ts`: 연속 구간 검증, 방향·위상·관절 선택. 테스트는 카메라 구간 경계, 38° 후보, 각도별 착장 수, 새 영상의 방향 범위, 배경 모델 제외와 실제 매니페스트 재생 선택을 검사한다.
- `angle.ts`: 재생 시계, 방향·저장 조작, Canvas 출력. `atlas-pool.ts`: 중복 디코딩 방지와 LRU 페이지 수명 관리.
- `refine-angles.py`: 프레임별 마스크·전신 검증, 신장 보정, HD 아틀라스 출력. `matting.py`: ONNX/MPS 추론. 원본·원시 마스크·보정 PNG는 Git 제외 캐시에 보관한다.

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
curl -fL 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx' -o .cache/runway-walk/birefnet-lite.onnx

# Apple Silicon: 프레임별 추론 가속 (공식 고정 리비전, 로컬 실행)
uv pip install --python .cache/runway-walk/venv/bin/python -r scripts/runway-walk/requirements-mps.txt
.cache/runway-walk/venv/bin/python scripts/runway-walk/prepare-matting.py --cache .cache/runway-walk
.cache/runway-walk/venv/bin/python scripts/runway-walk/prepare-instance.py --cache .cache/runway-walk
.cache/runway-walk/venv/bin/python scripts/runway-walk/angles.py --cache .cache/runway-walk --output .cache/runway-walk/export --manifest-only
.cache/runway-walk/venv/bin/python scripts/runway-walk/refine-angles.py --cache .cache/runway-walk --output .cache/runway-walk/export --engine mps
```

위 명령은 Git 제외 스테이징에 출력한다. 원본·누끼·재생을 확인한 다음 `angles.json`과 그 안에 나열된 HD 아틀라스만 `pages/runway-walk/`에 반영한다. 인물별 분리를 사용하는 현재 자료는 `requirements-mps.txt`의 PyTorch·Transformers가 필요하며, CPU로 실행하려면 마지막 명령의 `--engine onnx`를 사용할 수 있다.

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
