# Runway Walk

루이비통 쇼의 실제 프레임에서 인물만 분리하고, 걸음의 위상을 맞춰 인물을 교체하는 시안 모음. `/runway-walk/`의 기본 화면은 원본 배경을 남긴 3프레임 사각 크롭이다. 같은 프레임의 누끼 버전과 나란히 비교할 수 있다. `/runway-walk/angle.html`은 인물과 숫자 각도만 표시한다. 화면 어디서든 좌우로 드래그해 방향을 바꾸고, 터치 중에는 공통 터치 포인터를 표시한다. 방향은 이 브라우저에 저장하며 새로고침 뒤 복원한다. 키보드는 좌우 방향키로 5°, Shift와 함께 1°씩 조절하고 Home으로 정면, Space로 재생·정지한다. 화면의 설명·출처·저장 버튼·슬라이더는 제거하고 보조기술용 방향 값과 상태만 유지한다.

루이비통 SS27, [Prada SS26](https://www.youtube.com/watch?v=SAjtxnyXu8U), [Prada SS25](https://www.youtube.com/watch?v=vz6dKkEiJzg), [Prada SS24](https://www.youtube.com/watch?v=BGWhB8dOKhc), [Fendi SS25](https://www.youtube.com/watch?v=TSzy2vbjTac), [Gucci SS25](https://www.youtube.com/watch?v=4kD2CrWB_6k), [Hermès SS26](https://www.youtube.com/watch?v=eQUau2GefuA), [Hermès Summer 2024](https://www.youtube.com/watch?v=cN12oPqe3Qc), [Hermès Summer 2025](https://www.youtube.com/watch?v=cZdY5tQkNIo)의 실제 프레임을 사용한다. 현재 117개 구간·105착장의 3701프레임을 512×768 투명 타일, 네 프레임씩 묶은 926장의 WebP 아틀라스에 보관한다. 미디어 전송량은 118.77 MB다. 같은 착장의 다른 구간은 `lookId`로 묶는다. 배경은 따뜻한 회색이며 원래 의상 색은 유지한다.

`angle-shots.json`의 방향은 화면을 직접 보고 붙인 카메라 기준 근사값이다. 선택 범위는 왼쪽 90°(−90°)부터 오른쪽 90°(+90°)까지다. 회전 구간은 확인한 시점의 `yawKeys`를 기준으로 프레임별 방향을 구한다. 좌우 반전이나 생성 프레임을 사용하지 않는다. 기존 정면 10구간의 334프레임은 보존한다. 아래 표의 정면 후보에는 허용 오차 안의 얕은 사선도 포함된다. 뒤의 모델이 붙던 Gucci 구간과 Fendi의 11프레임을 제외한 상태로, 부족한 방향에 Prada SS24의 회전 구간과 Hermès의 사선 구간을 보충했다. 반사로 몸이 왜곡되거나 다른 인물로 추적이 넘어간 프레임, 보라색 가방이 불안정하게 잘리는 구간은 제외했다.

정면부터 왼쪽 75°까지 기존 구간의 원본·누끼·재생 후보를 대조했다. 왼쪽으로 잘못 분류된 Prada SS25 두 구간은 오른쪽 10°로 기록해 왼쪽 후보에서 제외했다. 고정 태그를 쓰던 LV·Hermès 사선도 검토한 몸통 기준 시점으로 다시 분류했다. 노란 재킷·분홍 바지는 약 20~100°로 회전하므로 일부 실제 측면만 75°에 사용한다. 뒤쪽 방향을 75°로 제한해 저장하지 않으며, 제어 범위는 별도의 `yawRange`로 고정한다. 부족해진 측면은 Prada SS24·SS26의 실제 구간과 기존 구간의 연장으로 보충했다. 관객과 분리가 불확실한 회색 재킷·가방 구간은 제외하고, 머리·다리에 다른 사람이 붙거나 실루엣이 잘린 프레임은 제외·허용 목록으로 제한했다.

오른쪽은 Hermès Summer 2024·2025의 실제 전신 촬영으로 보충했다. 위에서 내려다본 구간, 전신이 잘린 클로즈업과 불확실한 관객 겹침은 제외한다. 오른쪽으로 이동하더라도 몸은 정면을 향할 수 있으므로 이동 방향이나 얼굴만 보고 측면으로 분류하지 않는다. 90°를 지나 뒤로 도는 모습은 실제 90° 초과 값으로 기록하며, 머리카락·신발·가방이 온전히 남은 프레임만 재생 후보로 사용한다. 왼쪽 75~90°도 같은 영상의 반대편 촬영으로 보충한다. 두 쇼의 30fps 원본을 25fps로 정규화하고, 같은 착장의 좌우 재등장은 하나의 `lookId`로 묶는다.

`yawMethod: reviewed-torso`를 사용하는 구간은 어깨와 골반의 좌우 축을 함께 비교해 회전 속도를 보정한다. MediaPipe 이미지 좌표의 x·z 축으로 각각 방향을 구하고 원형 평균을 낸 뒤, 주변 다섯 프레임의 중앙값으로 흔들림을 줄인다. 검토한 두 각도 사이에서 관측한 몸통 회전의 진행률을 사용하되, 시간 보간에 대한 보정은 최대 5°로 제한하고 기준 시점은 정확히 유지한다. 관절 신뢰도가 낮거나 두 축이 25° 넘게 어긋나거나 회전 방향이 맞지 않으면 시간 보간으로 돌아간다. 얼굴이 향하는 방향이나 사람의 화면상 이동량은 이 계산에 쓰지 않는다. [MediaPipe의 z 좌표 설명](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)에 따라 깊이의 상대 변화만 이용하며, 단일 영상의 추정 깊이를 정밀한 카메라 보정값으로 취급하지 않는다.

아래는 **선택한 방향에서 실제 연속 3프레임 재생이 가능한 후보**를 센 수치다. 세 프레임 모두 선택 각도의 절대 ±5° 안에 들어와야 한다. 가장 가까운 컷의 오차를 더해 허용 범위를 넓히지 않는다. 겹치는 블록의 원본 프레임은 한 번만 세고, 같은 착장의 재등장은 한 착장으로 센다. 1° 간격의 181개 방향 모두 100프레임·8착장 이상이며, 최소치는 102프레임·10착장이다. 화면은 숫자 각도만 표시하며 후보 수는 이 문서와 매니페스트에서 확인한다. 위상·관절 조건을 추가 적용한 실제 재생에서는 이 후보 중 일부를 선택한다.

| 선택 방향 | 착장 후보 | 실제 프레임 후보 |
| --- | ---: | ---: |
| 왼쪽 90° | 13 | 109 |
| 왼쪽 84° | 13 | 103 |
| 왼쪽 82° | 16 | 104 |
| 왼쪽 75° | 17 | 131 |
| 왼쪽 60° | 19 | 143 |
| 왼쪽 45° | 23 | 206 |
| 왼쪽 30° | 19 | 192 |
| 왼쪽 15° | 22 | 336 |
| 정면 | 16 | 392 |
| 오른쪽 6° | 12 | 109 |
| 오른쪽 15° | 22 | 192 |
| 오른쪽 30° | 25 | 150 |
| 오른쪽 45° | 30 | 203 |
| 오른쪽 60° | 25 | 155 |
| 오른쪽 75° | 23 | 159 |
| 오른쪽 90° | 13 | 106 |

보행 위상은 MediaPipe의 3D 발목 차이를 몸의 앞 방향에 투영하고 주기 함수를 맞춰 추정한다. 정면 근처의 사선 구간은 기준 정면 보행의 좌우 무릎·발목 차이와 비교해 위상 시작점을 추가 보정한다. 짧은 Hermès·Prada 회전 구간은 검토에서 남은 인물의 관절만으로 검토한 같은 방향의 기준 보행 한 주기에 주파수와 위상 시작점을 맞춘다. 다른 사람이 섞인 원시 검출 구간의 위상을 그대로 사용하지 않는다. 보행 시계는 방향과 독립적으로 계속 진행한다. 3프레임 경계마다 각 구간의 세 프레임에서 최소·최대 각도를 검사하고, 전체가 허용 방향 오차 안에 있는 구간만 후보로 삼는다. 회전 중인 구간의 대표 각도는 세 프레임의 평균이다. 직전 인물의 무릎·발목 위치와 이동 속도로 다음 프레임의 위치를 예상하고, 그 위치·이동 방향·보행 위상을 함께 비교한다. 비슷한 자세에서 발이 반대로 움직이는 컷의 우선순위를 낮춘다. 최적 비용과 가깝고 위상 차이도 작은 후보 중 최근 네 착장을 피한다. 선택한 구간에서는 원본의 실제 연속 3프레임을 순서대로 보여준다. 관절은 보정된 타일에서 실제로 그려지는 위치를 비교한다. 골반을 원점으로 빼면 사람마다 골반 높이가 달라지는 것을 놓치므로, 화면상의 무릎·발목 위치와 이동 방향을 직접 사용한다.

자세 감지가 신발 클로즈업을 전신으로 오인한 프레임이 있었다. 이제 지정 구간 안의 카메라 컷을 원본 RGB 변화로 따로 찾고, 전신 자세가 가장 많이 검출된 한 쇼트만 남긴다. 카메라가 바뀐 프레임을 같은 구간으로 연결하지 않는다. 회전 중인 짧은 구간도 수동으로 줄인다.

[BiRefNet lite](https://huggingface.co/ZhengPeng7/BiRefNet_lite)로 각 1080p 원본 프레임의 알파를 직접 계산한다. 이전 여섯 프레임 간격의 키 마스크와 optical flow는 가방 끈·발의 경계를 잘못 옮기는 경우가 있어 제거했다. 선택한 골반의 연결 성분과, 보이는 머리·팔다리·손 근처의 분리 성분을 유지한다. 가방처럼 큰 성분도 손 근처에서 지지를 받으면 보존한다. 발목 주변의 기하학적 제한으로 실제 신발이 잘리던 처리도 제거했다. 머리나 보이는 무릎·발목이 마스크에서 사라진 프레임은 제외한다.

Louis Vuitton의 파도 무늬가 머리에 붙는 현상은 현재 프레임의 MediaPipe 인물 마스크로 어깨 위 영역을 추가 제한한다. 새 Prada SS25의 가방 없는 네 구간은 관객의 손·다리가 인물에 붙는 것을 막기 위해 목 아래 영역에 이 제한을 적용하고 머리의 직접 마스크는 유지한다. 검은 코트 구간은 얼굴 위치를 기준으로 넉넉한 머리 영역을 추가 제한해 뒤쪽 관객의 머리가 붙는 것을 막는다. 청록색 셔츠 구간에서 손에 붙는 중립색 무대 테두리는 그 구간의 손 주변에서만 추가 제거한다. 관객의 손이 붙거나 머리 끝이 잘린 것으로 직접 확인한 프레임도 제외 목록에 기록한다. Prada의 흰 난간과 검은 무대 장식이 남던 두 구간도 전신 지지 마스크로 정리한다. Fendi의 겹침 구간에는 원본 ROI에서 직접 확인한 `matteRegion`을 적용한다. 이 영역은 누끼를 새로 그리지 않고 인물 바깥의 다른 모델만 제외하므로 실제 가방은 원시 알파 그대로 유지한다. 영역이 겹쳐 분리가 불확실한 프레임은 제외한다. 기존 MediaPipe의 전신 제한은 가방이 있는 구간에 적용하지 않는다. 원본 RGB를 섞거나 얼굴·옷을 생성하지 않는다. 자동 마스크의 작은 테두리 오차와 원본 촬영 해상도의 한계는 남는다.

새 Prada SS24와 추가 Hermès 구간은 [SAM2.1 tiny](https://huggingface.co/facebook/sam2.1-hiera-tiny)의 인물별 마스크로 다른 모델·관객을 분리한다. 실제로 보이는 얼굴·어깨·골반·팔·다리 좌표를 양성 지점으로 사용하며, 가방은 원본에서 확인한 별도 지점을 시간에 따라 보간해 함께 분리한다. 인물 마스크만으로 가방을 지우거나 배경을 채워 넣지 않는다. 경계의 부드러운 알파와 모든 RGB는 BiRefNet 및 촬영 원본에서 가져온다. 골반에 연결되지 않은 잔여 관객의 손은 제외하되, 명시한 가방 지점의 성분은 보존한다. 보이는 팔이 중간에 끊기거나 누끼가 원본 크롭 가장자리에 닿는 컷은 제외한다. 유리 반사, 인물 교체, 불안정한 가방 경계는 검토 목록으로 추가 제외한다. 모델·설정의 고정 리비전과 SHA-256은 `prepare-instance.py`에서 검증한다.

인물별 지지 영역이 실제 머리카락·신발까지 지우는 구간은 검토 후 의미 마스크의 logit 임계값을 완화한다. 지지 영역은 배경을 제외하는 용도이며 최종 경계 알파는 BiRefNet에서 유지한다. 관객이 겹치는 구간에는 더 엄격한 기준과 머리 영역의 별도 임계값을 사용한다. [SAM2의 비이진 마스크 출력](https://huggingface.co/docs/transformers/v4.57.0/model_doc/sam2)을 이용하며, 의미 마스크를 불투명한 전경으로 덧칠하지 않는다.

Gucci의 작은 노란 가방은 원본의 작은 검토 영역을 별도로 추론해 누락된 알파를 복구하고, 실제 가방 지점의 분리 성분도 보존한다. Hermès의 불투명한 가방 몸통이 구멍처럼 지워지는 컷은 원본에서 확인한 몸통 지점이 속한 닫힌 알파 구멍만 복구한다. 바깥 배경에 연결되거나 지나치게 큰 영역은 거부하고 손잡이의 빈 공간은 유지한다. 가방에 실제로 가려진 발목 한 지점은 검토 목록으로 가시성 검사에서 제외한다. LV의 세 프레임에서 엉뚱한 곳을 가리키던 발목 좌표는 원본의 바지 끝과 신발 위치를 보고 수정한다. 이 좌표는 완전성 검사와 화면 관절 비교에 함께 사용하며, 원본 픽셀을 변형하지 않는다. Hermès의 다리 사이 배경을 무릎·발목으로 잡은 한 프레임과 좌우 관절을 바꾼 다음 프레임도 원본 좌표로 바로잡았다. 바지 끝에서 벗어난 발목 두 프레임은 실제 바지·신발 경계로 보정했다. 누끼 자체는 정상인 이 프레임들은 검증을 완화하지 않고 복구한다. 모든 색·무늬는 해당 원본 프레임의 RGB다.

Apple Silicon에서는 공식 모델의 고정 리비전을 로컬에 내려받아 MPS로 처리한다. 다운로드 스크립트가 모델과 실행 코드의 SHA-256을 확인한다. ONNX CPU 실행도 선택할 수 있다. 마스크 캐시는 인물 선택 이전의 원시 알파를 보관하므로 정리 규칙을 바꿔도 가방이나 분리된 신체 영역을 다시 복구할 수 있다.

크기는 굽힌 다리의 2D 길이 대신 알파의 머리 끝부터 발바닥까지의 높이로 맞춘다. 각 프레임의 전신 높이를 660px, 발바닥을 720px로 맞춘다. 골반 가로 위치는 구간 안에서 안정화한다. 바닥 높이를 시간 방향으로 평균하면 발이 뜨므로 현재 프레임의 발바닥을 직접 기준으로 삼는다. 가방·모자·보폭이 타일을 벗어나면 확대를 제한한다. 가로세로 비율과 실제 체형은 유지한다. 알파를 곱한 상태에서 리샘플링해 투명 경계의 색 번짐을 줄인다.

브라우저는 현재와 다음 재생 구간에 필요한 페이지부터 요청한다. 압축 Blob은 최근 24장, ImageBitmap은 최대 다섯 페이지만 유지하며 오래된 디코딩 페이지는 `close()`로 해제한다. 전체 자료를 먼저 내려받지 않으므로 방향 자료가 늘어나도 첫 인물은 필요한 한두 페이지만 도착하면 표시된다. 드래그 중 이전 요청이 늦게 도착해도 최신 방향을 확인한 뒤 출력한다. 숫자 각도도 인물 프레임과 함께 갱신해, 새 이미지를 기다리는 동안 숫자만 먼저 바뀌지 않는다. 디코딩한 아틀라스 픽셀은 최대 약 31.5MB이며 압축 Blob·Canvas 메모리는 별도다. 이전 MP4 시안은 변경하지 않는다.

- `angles.json`: 출처, 구간·착장 ID, 정규화 원본 프레임 번호, 근사 방향, 보행 위상, 관절·크기 보정 정보, 아틀라스 인덱스.
- `scripts/runway-walk/angle-sources.json`: 원본 URL, 로컬 파일, 원본·정규화 fps와 시작 오프셋. Prada SS25는 50fps, Fendi SS25는 30fps 원본을 25fps로 맞춘다. Fendi 캐시는 원본 1690초부터 635초 구간이다. 원본 시각은 `sourceOffset + sourceFrame / fps`로 복원한다.
- `angle-match.ts`: 연속 구간 검증, 방향·위상·관절 선택. 테스트는 카메라 구간 경계, 75° 오분류, 각도별 착장 수, 새 영상의 방향 범위, 배경 모델 제외와 실제 매니페스트 재생 선택을 검사한다.
- `angle.ts`: 재생 시계, 방향·저장 조작, Canvas 출력. `atlas-pool.ts`: 중복 디코딩 방지와 LRU 페이지 수명 관리.
- `solid_accessory.py`: 검토한 불투명 가방 몸통의 닫힌 알파 구멍만 복구한다. 손잡이·외부 배경을 보존하는 회귀 검사를 포함한다.
- `body_yaw.py`: 검토한 각도 기준과 어깨·골반의 상대 회전을 결합한 프레임별 보간.
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
