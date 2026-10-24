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

루이비통 SS27, [Prada SS26](https://www.youtube.com/watch?v=SAjtxnyXu8U)의 실제 프레임을 사용한다. 현재 8개 구간의 331프레임을 512×768 투명 타일, 네 프레임씩 묶은 83장의 WebP 아틀라스에 보관한다. 미디어 전송량은 약 12.7MB다. 배경은 따뜻한 회색이며 인물의 원래 의상 색은 유지한다.

`angle-shots.json`의 방향은 촬영 화면을 직접 보고 붙인 카메라 기준 근사값이다. **각 원본 프레임에 구간의 방향을 저장**한다. 몸을 돌리는 도중 방향 표시와 실제 자세가 맞지 않았던 초록 상의·검은 코트 구간은 전체 제외했다. 카메라 보정으로 측정한 정확한 각도가 아니다. 선택 가능한 범위는 연속 3프레임을 확보한 약 왼쪽 75°부터 정면까지다. 반대 방향 후보는 발이 원본 밖으로 잘려 제외했다. 촬영된 방향이 드문 대역은 같은 사람을 재사용한다. 전방위 회전이나 동일 인물의 다중 시점 재구성은 아니다. 좌우 반전·몸 변형·생성 프레임을 사용하지 않는다.

보행 위상은 MediaPipe의 3D 발목 차이를 몸의 앞 방향에 투영하고 주기 함수를 맞춰 추정한다. 재생 시 보행 시계는 방향과 독립적으로 계속 진행한다. 3프레임 경계에서 가까운 방향 대역(최근접 각도 오차 + 5° 이내), 현재 위상, 최근 인물 사용을 함께 비교한다. 선택한 구간 안에서는 원본의 실제 연속 3프레임을 순서대로 보여준다. 같은 방향의 인물이 부족하면 같은 사람을 다시 사용한다. 인물·카메라마다 자세 추정과 원근이 달라 연결에 점프가 남을 수 있다.

머리·발이 원본 밖으로 잘린 후보와 너무 짧은 구간은 제외한다. 인물 전체를 같은 비율로 이동·확대해 골반 가로 위치와 발밑 높이를 맞추고, 머리가 타일 밖으로 나가면 확대를 제한한다. 알파를 곱한 상태에서 리샘플링한 뒤 투명 타일로 저장한다. 원본은 두 쇼 모두 1080p에서 다시 읽는다. [Robust Video Matting](https://github.com/PeterL1n/RobustVideoMatting)의 recurrent 상태를 원본 연속 프레임 사이에 유지해 알파를 추정하고, 골반이 속한 연결 성분만 남겨 관객·작은 배경 조각을 제거하고, 확실한 전경 주변의 좁은 반투명 경계만 유지해 옷·가방에 붙은 옅은 잔여물을 억제한다. 불투명한 내부는 원본 RGB를 유지하며 가장자리만 모델의 전경색으로 배경색 번짐을 보정한다. 파란 스웨터 구간에서 밝은 바닥과 혼동하던 흰 운동화 끝은 발 관절 주변으로 제한한 MediaPipe 마스크로 보완한다. 위치·크기 추정값만 시간 방향으로 안정화하며 움직이는 RGB·알파를 프레임끼리 섞지 않는다.

브라우저는 약 12.7MB의 압축 페이지를 최대 여섯 요청으로 읽고, ImageBitmap은 최대 다섯 페이지만 디코딩한다. 다음 3프레임 구간을 미리 디코딩하고 오래된 페이지는 `close()`로 해제한다. 디코딩된 아틀라스 픽셀은 최대 약 31.5MB이며 압축 Blob·Canvas 메모리는 별도다. 얼굴·머리·원본 촬영 압축의 한계와 자동 마스크의 일부 누락은 남는다.

- `angles.json`: 출처, 구간, 원본 프레임 번호, 근사 방향, 보행 위상, 아틀라스·타일 인덱스.
- `angle-match.ts`: 실제 연속 구간 검증과 방향·위상 선택. `angle-match.test.ts`는 원본 프레임 누락·구간 경계 및 실제 매니페스트 선택을 검증한다.
- `angle.ts`: 재생 시계, 드래그·키보드·슬라이더, 방향 저장과 Canvas 출력. `atlas-pool.ts`는 중복 디코딩 방지와 제한된 LRU 페이지 수명을 관리한다.
- `refine-angles.py`: 동일한 원본 프레임·방향·위상을 유지한 고해상도 재매팅과 아틀라스 출력. 이 단계는 이전 MP4 시안을 변경하지 않는다.

추가 소스를 로컬 캐시에 받은 뒤 재현한다. 원본 영상은 Git에 포함하지 않는다.

```sh
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 136 -o .cache/runway-walk/prada-ss26.mp4 'https://www.youtube.com/watch?v=SAjtxnyXu8U'
.cache/runway-walk/venv/bin/python scripts/runway-walk/angles.py --cache .cache/runway-walk --output pages/runway-walk
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 137 -o .cache/runway-walk/prada-ss26-hd.mp4 'https://www.youtube.com/watch?v=SAjtxnyXu8U'
curl -fL 'https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx' -o .cache/runway-walk/rvm-mobilenetv3.onnx
.cache/runway-walk/venv/bin/python scripts/runway-walk/refine-angles.py --cache .cache/runway-walk --output pages/runway-walk
```

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
