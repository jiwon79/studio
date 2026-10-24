# Runway Walk

루이비통 쇼의 실제 프레임에서 인물만 분리하고, 걸음의 위상을 맞춰 인물을 교체하는 시안 모음. `/runway-walk/`에서 색의 흐름과 발 디딤 버전을 나란히 재생하거나, 각 버전을 따로 볼 수 있다. 두 영상을 함께 일시정지하고 한 프레임씩 이동할 수 있다. 갤러리 인덱스에는 추가하지 않았다.

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

개별 미리보기는 `?mode=color`, `?mode=footfall`, 나란히 보기는 `?mode=compare`로 열 수 있다. 기존 `frame`, `step` 버전도 같은 화면에서 선택한다.

## 다시 만들기

Python 3.11+, FFmpeg, uv, 최신 yt-dlp가 필요하다. 원본, 모델, 인물 PNG 캐시는 Git에 포함하지 않는다. 아래 작업 디렉터리는 로컬의 임시 공간이다. 현재 작업을 끝낸 뒤에는 임시 캐시를 제거하므로 다시 만들 때 원본과 모델부터 받아야 한다.

```sh
mkdir -p .qa/runway
uv venv --python 3.11 .qa/runway/venv
uv pip install --python .qa/runway/venv/bin/python -r scripts/runway-walk/requirements.txt
uv tool run --from 'yt-dlp[default]' yt-dlp --no-playlist -f 137 -o .qa/runway/source.mp4 'https://www.youtube.com/watch?v=qcE5NeDUvIk'
curl -fLs 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task' -o .qa/runway/pose.task
.qa/runway/venv/bin/python scripts/runway-walk/extract.py --source .qa/runway/source.mp4 --pose-model .qa/runway/pose.task --cache .qa/runway/clips
.qa/runway/venv/bin/python scripts/runway-walk/compose.py --cache .qa/runway/clips --output pages/runway-walk
.qa/runway/venv/bin/python scripts/runway-walk/extract.py --source .qa/runway/source.mp4 --pose-model .qa/runway/pose.task --cache .qa/runway/clips --footfalls scripts/runway-walk/footfalls.json
.qa/runway/venv/bin/python scripts/runway-walk/variants.py --cache .qa/runway/clips --output pages/runway-walk
ffmpeg -hide_banner -loglevel error -y -i pages/runway-walk/media/runway-frame.mp4 -filter_complex '[0:v]scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 pages/runway-walk/media/preview.gif
ffmpeg -hide_banner -loglevel error -y -i pages/runway-walk/media/runway-color.mp4 -i pages/runway-walk/media/runway-footfall.mp4 -filter_complex '[0:v]scale=256:384:flags=lanczos[a];[1:v]scale=256:384:flags=lanczos[b];[a][b]hstack,split[c][d];[c]palettegen=stats_mode=diff[p];[d][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 pages/runway-walk/media/compare.gif
```

쇼의 정면 카메라 구간 27개를 지정한 처리기다. 다른 영상에 그대로 적용하는 범용 탐지기는 아니다. 중앙 ROI에서 MediaPipe로 신체 좌표와 마스크를 얻고, 전신이 보이는 프레임만 남긴다. 골반 위치와 다리 길이로 크기를 맞추며, 마스크의 골반 연결 성분을 남긴다. 리샘플링 전에 알파를 곱해 배경색의 가장자리 번짐을 줄인다.

좌우 발목 높이 차이에 주기 함수를 맞춰 보행 위상과 방향을 추정한다. 파란 스웨터 구간(276초)의 보행을 기준으로 무릎·발목·발 모양과 이전 자세의 차이를 함께 비교한다. 30프레임 주기를 여섯 번 진행하며 최근 사용한 인물은 잠시 제외한다. 얼굴이나 의상을 생성하거나 몸을 변형하지 않는다.

자동 마스크라 머리카락·가방·발 주변에 약한 테두리나 누락이 남는다. 사람마다 보폭과 팔 동작이 달라 자세가 완전히 일치하지는 않는다. 3프레임 버전은 선택한 구간 안에서 원본 프레임이 실제로 연속되는지 검사한다. 프레임 교체와 마스크의 최종 판단은 실제 재생 화면으로 한다.

## 두 가지 추가 시안

색 버전은 의상 색을 보고 정한 인물 순서의 가까운 세 후보 안에서 걸음이 맞는 프레임을 고른다. 골반과 다리 길이의 정렬은 기존 시안과 공유한다. 빠른 인물 교체 안에 큰 색의 흐름이 생기도록 한 편집 규칙이며, 색을 다시 칠하거나 인물 사이를 겹쳐 녹이지 않는다.

발 디딤 버전은 자동 주기 추정만으로 컷을 정하지 않는다. `scripts/runway-walk/footfalls.json`에 원본 신발과 바닥의 접촉을 직접 확인한 시작·끝 프레임을 기록했다. `foot`은 화면 방향이 아닌 사람의 왼발·오른발이다. 시작부터 다음 반대 발 접촉 직전까지 원본의 순서를 유지하며, 한 구간을 15프레임(0.6초)으로 맞춰 중복 또는 생략 샘플링한다. 각 컷에서는 좌우 발이 번갈아 닿는다. 바닥 높이 차이를 줄이기 위해 인물 전체의 세로 위치도 맞춘다.

일부 프레임은 가려진 관절의 신뢰도가 낮아 첫 추출에서 빠졌다. 수동으로 확인한 발 디딤 구간만 다시 추출해 `poses-contact.json`에 보관하며, 기존 `poses.json`과 분리한다. 배경 사람과 겹치는 검은 가죽 재킷 구간(800초)은 새 두 버전에서 제외했다. 접촉 시점은 25fps 영상에서의 시각적 판단이므로 정밀한 보행 측정값은 아니다.
