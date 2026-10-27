# Runway Walk

루이비통 쇼의 실제 프레임에서 인물만 분리하고, 걸음의 위상을 맞춰 인물을 교체하는 시안 모음. `/runway-walk/`의 기본 화면은 원본 배경을 남긴 3프레임 사각 크롭이다. 같은 프레임의 누끼 버전과 나란히 비교할 수 있다. `/runway-walk/angle.html`은 인물과 숫자 각도만 표시한다. 화면 어디서든 좌우로 드래그해 5° 단위로 방향을 바꾸고, 터치 중에는 공통 터치 포인터를 표시한다. 방향은 이 브라우저에 저장하며 새로고침 뒤 복원한다. 키보드는 Shift 여부와 관계없이 좌우 방향키로 5°씩 조절하고 Home으로 정면, Space로 재생·정지한다. 화면의 설명·출처·저장 버튼·슬라이더는 제거하고 보조기술용 방향 값과 상태만 유지한다.

루이비통 SS27, [Prada SS26](https://www.youtube.com/watch?v=SAjtxnyXu8U), [Prada SS25](https://www.youtube.com/watch?v=vz6dKkEiJzg), [Prada SS24](https://www.youtube.com/watch?v=BGWhB8dOKhc), [Fendi SS25](https://www.youtube.com/watch?v=TSzy2vbjTac), [Gucci SS25](https://www.youtube.com/watch?v=4kD2CrWB_6k), [Hermès SS26](https://www.youtube.com/watch?v=eQUau2GefuA), [Hermès Summer 2024](https://www.youtube.com/watch?v=cN12oPqe3Qc), [Hermès Summer 2025](https://www.youtube.com/watch?v=cZdY5tQkNIo), [Hermès Winter 2025](https://www.youtube.com/watch?v=UtEVDZp-tCo)의 실제 프레임을 사용한다. 추가로 Hermès Summer 2023·Summer 2022·Winter 2023·Winter 2022, Homme Plissé Summer 2025, Dries Van Noten Summer 2024, Issey Miyake Summer 2019, Prada Winter 2012·Winter 2013을 사용한다. 원본 링크는 `angle-sources.json`에 있다. 현재 소지품이 없는 169개 구간·156착장·5355프레임을 사용한다. HD 출력은 512×768 투명 타일, 네 프레임씩 묶은 1350장의 WebP 아틀라스이며 총 155.69 MB다. 같은 착장의 다른 구간은 `lookId`로 묶는다. 배경은 따뜻한 회색이며 원래 의상 색은 유지한다.

방향 화면에서는 손에 든 가방·토트·클러치와 크로스백이 있는 착장을 구간 전체로 제외한다. 의상에 걸쳐진 가방을 알파에서 지워 팔·옷의 빈 부분을 만들지 않는다. `angle-shots.json`의 `carriedItems: "none"`은 소지품이 없는 구간의 검토 표시이며, 추출기는 표시가 없는 구간을 거부한다. 모자·신발·안경 등 착용한 의상은 유지한다. 가방 착장 44구간과 팔 옆이나 코트 밑단에 관객 잔여가 붙은 두 구간을 제외하고, 기존 구간의 깨끗한 부분을 연장하고 Hermès의 소지품 없는 구간을 보충했다. 카메라가 높아 체형과 수직 방향이 달라 보이는 두 구간은 제외한다. 관객의 머리·팔이나 우산이 붙은 프레임은 `excludedFrames`·`reviewedFrames`로 제한하고, 원본에서 확인한 세 프레임의 좌우 다리 감지 오류는 `poseXYOverrides`로 바로잡는다. 기존 정면 자료 중 소지품 없는 4구간·111프레임은 유지한다. 이전 MP4 비교 시안은 별도 자료다.

`angle-shots.json`의 방향은 화면을 보고 붙인 카메라 기준 근사값이다. 선택 범위는 −90°부터 +90°까지 5° 간격의 37방향이다. 저장된 중간 각도도 가까운 5°로 맞춘다. `yawKeys`를 기준으로 어깨·골반의 상대 회전을 제한적으로 반영한다. 머리 방향이나 화면 이동만으로 몸통 방향을 정하지 않는다. 뒤쪽으로 돌아선 프레임은 원래의 90° 밖 각도를 보관한다. 좌우 반전이나 생성 프레임을 사용하지 않는다.

아래는 선택한 방향에서 연속 3프레임 재생이 가능한 후보 수다. 세 프레임 모두 선택 각도의 절대 ±5° 안에 있어야 한다. 겹치는 블록의 원본 프레임은 한 번만, 같은 착장의 재등장도 한 착장으로 센다. 선택 가능한 37개 방향의 최소치는 **121프레임·9착장**이다. 모든 방향에서 최소 100프레임·8착장의 후보 수를 충족한다. 모든 선택 방향에 최소 9착장이 있다. 실제 보행 선택에는 위상·관절·속도 조건이 추가되므로 후보 전체가 항상 재생되지는 않는다.

| 선택 방향 | 착장 후보 | 실제 프레임 후보 |
| --- | ---: | ---: |
| 왼쪽 90° | 23 | 269 |
| 왼쪽 75° | 25 | 216 |
| 왼쪽 60° | 33 | 339 |
| 왼쪽 45° | 28 | 193 |
| 왼쪽 30° | 23 | 245 |
| 왼쪽 15° | 22 | 268 |
| 정면 | 14 | 219 |
| 오른쪽 15° | 15 | 140 |
| 오른쪽 30° | 30 | 231 |
| 오른쪽 45° | 22 | 148 |
| 오른쪽 60° | 21 | 136 |
| 오른쪽 75° | 32 | 289 |
| 오른쪽 90° | 33 | 530 |

현재 보행 기준은 [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html)의 기존 인체 모델과 `Walk_Formal_Loop` 클립이다. 공식 Standard 배포본의 `Unreal-Godot/UAL1_Standard.glb`에서 사용하지 않는 애니메이션 데이터만 제거했다. 메시, 스킨, 뼈, 걷기 키프레임은 원본 그대로이며 CC0 원문은 `media/reference/LICENSE.txt`에 보관한다. 제작자가 만든 기존 애니메이션이며 모션 캡처로 확인된 자료는 아니다. 직접 만든 인체·IK 보행은 사용하지 않는다.

`import-reference.mjs`는 같은 GLB를 Three.js AnimationMixer로 재생해 120개 시점의 실제 관절을 `reference-motion.json`으로 추출한다. 뒤꿈치·발끝은 원본 발 메시의 바닥 부근 정점들에서 추출하므로 원본 발목 회전과 뒤꿈치→발끝 착지를 유지한다. 다른 얼굴 관절 위치는 머리 뼈의 대표 위치이며 매칭에는 쓰지 않는다. 비교 화면도 같은 GLB와 원본 클립을 같은 시점으로 재생한다. 원본 주기는 약 1.333초이며 25fps 시계가 이 길이를 유지한다. 방향 회전과 일정한 바닥 등록 외에는 모델의 움직임을 수정하지 않는다. 사진과 기준의 골반 중심·다리 길이로 특징만 정규화하고 원본 사진의 픽셀이나 체형은 변형하지 않는다.

`fit-reference.mjs`는 33개 관절에서 각 사진의 특징을 추출한다. 연속 원본 프레임에서 같은 발보다 반대 발 대응이 세 배 이상 가깝고 같은 발의 이동이 다리 길이의 14%를 넘는 급변은 의심 구간으로 표시한다. 전후 두 프레임까지 재생과 위상 맞춤에서 제외하고, 남는 안정 구간이 너무 짧으면 그 구간 전체를 보류한다. 자동 의심은 실제 좌우 오류의 확정 판정이 아니며 디버그에서 원본을 확인한다. 한 원본 구간에 하나의 앞으로 가는 주기와 시작 위상을 맞춰 `reference-matches.json`에 기록한다. 원본에서 감지한 왼쪽 관절은 기준의 왼쪽 관절하고만 맞춘다. 반대 발 대응이 더 유리한 사진은 거부하며, 그 대응을 실제 선택에 사용하지 않는다. 이전 v30 선택기는 사진마다 좌우 대응과 반주기 기준을 바꿀 수 있어 발 위치는 가까워도 내딛는 발이 바뀌는 문제가 있었다. 예전 선택기는 회귀 검사용으로만 남기고 현재 비교·작품에는 쓰지 않는다. `angles.json.phase`도 예전 기준으로 남기며 현재 매칭은 `reference-matches.json`을 사용한다.

작품·디버그·드래그 사진은 모두 `ReferenceSequencer`를 사용한다. 원본 클립 길이를 따르는 독립 시계의 같은 시점에 대해 연속 사진 구간 전체의 같은 발 위치·이동과 각도, 이전 인물과의 기울기·몸통 중심을 평가한다. 개별 원본의 맞춤 오차가 0.4를 넘거나 원본 구간에 맞춘 위상이 기준에서 0.22주기 이상 벗어난 후보는 사용하지 않는다. 이 값은 다리 길이로 정규화한 특징 거리·추정 위상이며 실제 관절 측정 정확도를 뜻하지 않는다. 호환되는 후보가 있으면 이전 인물과 몸통 차이 4°·예측 발 위치 차이 32px 안에서 고른다.

`build-schedule.mjs`는 사진 순서를 오프라인에서 탐색해 300프레임 닫힌 루프를 만든다. 같은 착장은 정확히 3프레임씩 등장하고 다음 블록은 다른 착장이다. 마지막→첫 프레임까지 동일한 고정 오차 기준을 통과해야 `reference-schedule.json`에 기록한다. 소스의 한 프레임을 건너뛰는 경우에도 실제 사진 세 장을 앞으로 재생하며 이동 오차를 모두 검사한다. 같은 원본 사진은 한 보행 주기 안에 재사용하지 않는다. 좌우 관절 교환·반전·생성·보간 사진은 사용하지 않는다.

작품의 `reference-schedule.json`으로 직접 내보낼 때 요청한 각도가 하나라도 실패하면 기존 파일을 보존한다. 일부 각도만 다시 계산한 경우에는 사진·보행 기준·검토 정책이 모두 일치할 때만 해당 방향을 교체하며, 나머지 방향은 유지한다. 미달 후보가 포함된 실험은 `.qa/`의 별도 출력에서 검토한다. 특정 각도를 공유할 때는 `/runway-walk/angle.html?angle=85`처럼 링크에 방향을 지정할 수 있으며, 이 값은 브라우저에 저장된 방향보다 우선한다.

현재 검증된 순서는 −90°, −65°~+30°, +45°, +55°~+90°의 30개 각도에 있다. 승인된 +30°·+80°·+85°의 사진 순서·배치는 보존했다. 나머지 7개 각도는 아직 기준 미달이다. 데이터·관절 맞춤·보행 시계·검토 정책 버전이 모두 일치할 때만 적용한다. 드래그 중간 진입은 첫 블록만 짧을 수 있다. 아직 검증된 순서가 없는 방향은 기존 온라인 선택기를 사용하므로 자연스러움이 개선 완료된 방향으로 표시하지 않는다. 기존 선택기는 3프레임을 우선하되 필요하면 실제 2·1프레임을 선택하고 같은 착장의 연속 원본을 이어갈 수 있다. 이 경우에도 반대 발 선택, 한 주기 내 동일 사진 재사용과 시계 되돌림은 금지한다. 맞는 후보가 전혀 없으면 보행을 멈추고 소스 부족을 알린다.

+30°·+80°를 포함한 25개 각도는 같은 착장의 세 프레임 동안 사진 전체의 크기와 회전을 고정한다. 얼굴·어깨·골반·같은 발을 함께 정렬해 계산한 이동량만 프레임별로 적용하며, 변환은 `reference-schedule.json`에 저장한다. 작품·기준 모델 비교·디버그 관절·수치 검사는 동일한 변환을 사용한다. +85°의 원래 배치와 순서는 유지한다.

`upper-body-quality.ts`는 얼굴 중심의 이동에서 기준 보행의 이동을 빼고, 같은 사람 안의 전환과 사람 교체를 따로 검사한다. 승인된 +85° 측정값을 올림한 기준은 같은 사람 안에서 P95 7px·최대 8px, 사람 교체에서 P95 21px·최대 34px이며 얼굴 관절 신뢰도가 낮으면 측정에서 제외하고 유효 범위 95%를 요구한다. 검증된 30개 각도는 이 기준과 기존 발·몸통 기준을 함께 통과한다. 다른 각도는 이 추가 기준으로 재검토 중이며, 기존 발·몸통 검사 통과만으로 얼굴 안정화까지 끝났다고 판정하지 않는다. 사진 크기·회전이 세 프레임 안에서 바뀌거나 얼굴 이동이 기준을 넘으면 회귀 테스트가 실패한다.

미리 디코딩한 상태와 화면에 표시한 상태를 분리한다. 방향 변경 시 실제 표시한 사진까지만 사용 이력에 넣고 미래 버퍼를 버린다. 디코딩 대기는 시계도 기다리며 드래그 중에는 같은 3D 시계로 진행한다. 서로 다른 사람의 보폭, 가려진 발, 잘못 추정된 관절과 카메라 조건 때문에 잔차는 남을 수 있다. 3D 기준에 대한 수치만으로 모든 전환을 자연스럽다고 판정하지 않는다.

카메라 컷은 원본 RGB 변화로 분리하고, 한 쇼트 안의 전신 자세만 사용한다. [BiRefNet lite](https://huggingface.co/ZhengPeng7/BiRefNet_lite)가 각 1080p 원본 프레임의 알파를 직접 계산하고, 군중 구간은 [SAM2.1 tiny](https://huggingface.co/facebook/sam2.1-hiera-tiny)의 인물 지지 영역으로 다른 모델·관객을 제외한다. 보이는 머리·팔·무릎·발목이 사라지거나 원본 크롭 가장자리에 닿는 프레임은 제외한다. 필요한 구간에는 `reviewedFrames`, `excludedFrames`, 머리 영역과 지지 마스크 임계값을 기록한다. 얼굴·의상·가려진 신체를 생성하거나 원본 RGB를 섞지 않는다. 자동 마스크의 작은 테두리 오차와 원본 촬영 해상도의 한계는 남는다.

크기는 굽힌 다리 길이 대신 알파의 머리 끝부터 발바닥까지로 맞춘다. 전신 높이 660px, 바닥 720px를 기준으로 골반 가로 위치를 안정화하고 타일 폭을 넘는 확대는 제한한다. 가로세로 비율과 실제 체형을 유지한다. 알파를 곱한 상태에서 리샘플링해 경계 번짐을 줄인다. 감지기가 신발 옆 배경이나 다리 사이를 잡은 관절은 원본과 확인한 `poseXYOverrides`로 보정하고, 완전성 검사는 완화하지 않는다.

드래그 중에도 512×768 원본 해상도를 유지한다. `drag.json`은 37방향·여덟 보행 위상의 228프레임을 10페이지에 보관한다. 인물 바깥의 완전 투명 여백만 잘라 패킹하며, 축소나 RGB 재압축 없이 원본 HD 픽셀을 lossless WebP로 저장한다. 생성기는 알파를 포함한 픽셀 일치를 검사한다. 출력할 때 여백의 원래 위치를 복원해 1:1로 그리므로 확대된 저해상도 프리뷰로 바뀌지 않는다. 전송량은 17.37 MiB, 디코딩 픽셀은 150.74 MiB다. 드래그 중 네트워크 요청·디코딩 없이 상주 사진으로 보행을 그리며, 숫자와 인물을 함께 갱신한다. 각도 후보 풀도 재사용한다.

HD 사진과 드래그 프리뷰를 모두 내려받은 뒤 재생과 입력을 시작한다. 준비 중에는 글자 대신 작은 진행 링을 표시한다. HD 압축 Blob 전체를 보관하며 재생 중 추가 네트워크 요청은 없다. 현재 구간과 다음 세 구간을 미리 디코딩하고, 프레임 교체는 동기적으로 처리한다. 준비가 늦으면 보행 시계도 함께 기다려 이미지와 걸음 위상이 따로 진행하지 않는다. 방향 변경 중에는 상주 프리뷰를 표시하고 새 방향의 첫 네 구간이 준비되면 HD로 전환한다.

HD ImageBitmap은 12장까지 보관하고 오래된 페이지는 `close()`로 해제한다. 현재와 예정된 구간은 퇴출하지 않는다. HD 디코딩 픽셀은 최대 72 MiB이며 상주 드래그 사진·전체 압축 Blob·Canvas 메모리는 별도다. 전체 디코딩 픽셀은 HD 풀과 드래그 사진을 합쳐 약 222.74 MiB이며 압축 사진·Canvas는 추가된다. 모든 HD 사진을 디코딩해 수 GB를 상주시키는 방식은 사용하지 않는다. 최근 한 보행 주기의 사진 재사용과 같은 착장의 원본 되감기를 금지하고, 무릎·발목 좌표가 한 프레임에 화면 폭·높이의 12% 넘게 뛰는 블록은 보행 후보에서 제외한다.

- `angles.json`: 출처, 구간·착장 ID, 원본 프레임, 근사 방향, 보행 위상·관절과 HD 아틀라스 인덱스.
- `drag.json`, `scripts/runway-walk/drag-previews.py`: 최종 HD 자료와 버전이 일치하는 드래그용 프리뷰와 각도·위상 인덱스.
- `scripts/runway-walk/angle-sources.json`: 원본 URL, 로컬 파일, 원본·정규화 fps와 시작 오프셋. 원본 시각은 `sourceOffset + sourceFrame / fps`다.
- `gait-reference.ts`, `reference-motion.json`: 가져온 원본 클립의 관절 샘플과 방향 투영·정규화 특징.
- `reference-matches.json`, `fit-reference.mjs`: 사진별 3D 기준 특징·원본 구간의 주기 맞춤.
- `reference-sequencer.ts`: 3D 기준에 대한 같은 발 선택과 실제 표시 이력.
- `reference-clock.ts`: 가져온 원본 클립 길이를 따르는 보행 시계.
- `walk-sequencer.ts`: 공통 상태 타입·이력 재설정과 예전 v30 회귀 검사용 선택기.
- `angle-match.ts`: 연속 구간·방향 검증과 정적인 자세 비교. 테스트는 선택 가능한 37방향의 coverage와 원본 방향 범위의 절대 오차, 연속성, 착장 다양성, 소지품 구간 제외와 프리뷰 버전·메모리 상한을 검사한다.
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
.cache/runway-walk/venv/bin/python scripts/runway-walk/debug-poses.py --cache .cache/runway-walk --output .cache/runway-walk/export
node scripts/runway-walk/fit-reference.mjs .cache/runway-walk/export
.cache/runway-walk/venv/bin/python scripts/runway-walk/drag-previews.py --output .cache/runway-walk/export
```

위 명령은 Git 제외 스테이징에 출력한다. 원본·누끼·재생을 확인한 다음 `angles.json`·`debug-poses.json`·`reference-matches.json`·`drag.json`과 두 이미지 매니페스트에 나열된 아틀라스만 `pages/runway-walk/`에 반영한다. 인물별 분리를 사용하는 현재 자료는 `requirements-mps.txt`의 PyTorch·Transformers가 필요하며, CPU로 실행하려면 마지막 명령의 `--engine onnx`를 사용할 수 있다.

## 사진별 검토

`/runway-walk/debug.html?angle=10`에서 전체 3,311장의 등록 각도와 자동 추정 관절 33개를 검토한다. 기본 목록은 선택 각도의 ±5° 사진이며 보류 사진도 포함한다. 실제 재생 후보 수는 연속 3프레임·관절 연속성·검토 보류를 적용한 값으로 따로 표시한다. 전체 사진과 의견 있는 사진으로 범위를 바꾸거나 착장·원본 프레임 번호를 검색할 수 있다.

연결 재생과 전체 각도 검사는 작품과 같은 `ReferenceSequencer`를 사용한다. 보행 시계·사진 위상 오차·발 대응과 실제 원본 연속 여부도 표시한다. 정지 후 좌우 버튼으로 실제 연결 순서를 한 장씩 되짚을 수 있다. 이전 사진 겹치기, 관절·번호 표시, 배경 변경, 관절 좌표·신뢰도 표를 제공한다. 몸통 기울기·전신축과 이전 사진의 발 위치 차이를 수치로 표시하고, 차이가 크면 전환 주의를 표시한다. 공유 링크의 `previous`에 비교 사진 ID도 함께 담는다. “다른 각도의 문제 전환 찾기”는 37방향의 연결을 다시 계산하고 차이가 큰 앞뒤 사진을 함께 연다. 원본 비교는 해당 원본 프레임을 서버의 FFmpeg로 읽어 관절을 원래 좌표로 돌려 표시한다. 원본 캐시가 없는 환경에서는 영상의 해당 시각 링크를 사용한다.

`debug-poses.py`는 추출 캐시의 33개 관절에 검토한 XY 보정을 적용하고, 출력에 기록된 무릎·발목으로 동일 비율 등록 변환을 복원한다. `debug-poses.json`은 HD 사진 좌표와 대응하며, 생성기는 같은 좌표에서 뽑은 경량 몸통·발 특징을 `angles.json`의 `posture`에도 기록한다. 이 단계는 새 사진에 대한 실제 재생 선택에도 필요하다.  보간된 각도를 새 측정값으로 취급하지 않는다. 최대 등록 잔차는 0.015px 미만으로 검사한다.

사진 ID는 `source:sourceFrame`이며 공유 링크와 의견에도 유지한다. 의견에는 재생 각도, 문제 종류, 자유 의견, 선택한 관절·제안 각도·직전 사진을 기록한다. Vite 개발·미리보기 서버의 `/api/runway-walk/feedback`에서 읽고 쓰며 `.cache/runway-walk/feedback.jsonl`에 보관한다. 같은 서버를 보는 기기는 5초마다 갱신한다. 입력 초안은 기기에 임시 보관하고, 저장 뒤 서버를 다시 읽어 확인한다. 모든 의견을 JSON으로 내려받을 수 있다. 정적 배포만으로 공유 저장 기능이 생기지는 않는다.

Codex의 검토 결과와 재생 보류 범위는 `frame-audit.json`에 기록한다. +10° 검토에서 발의 진행 방향이 크게 다른 두 구간과 기울기가 다른 한 구간을 +5°·+10°·+15°에서 보류했다. +10° 실제 후보는 121장·9착장이다. 이 사진은 디버그 페이지에서 계속 볼 수 있다. 사용자 의견은 자동으로 작품의 제외 규칙이 되지 않는다. 검토 규칙을 바꾼 뒤에는 `drag-previews.py`도 다시 실행해 드래그 사진에 같은 보류를 적용한다.

```sh
.cache/runway-walk/venv/bin/python scripts/runway-walk/debug-poses.py --cache .cache/runway-walk --output pages/runway-walk
```

## 3D 기준 비교와 보행 검증

`/runway-walk/reference.html?angle=10&tick=53`은 가져온 인체의 원본 애니메이션과 같은 시점으로 고른 사진을 나란히 보여 준다. 왼발은 파랑 L, 오른발은 주황 R이다. 310장의 원본 다리 추정 의심 사진은 디버그에 남겨 검토할 수 있다. 물음표·점선은 이 의심 또는 낮은 관절 신뢰도다. 사진 표시도 원본 관절의 이름을 유지하며 비교를 좋게 보이게 하려고 색이나 이름을 바꾸지 않는다. 각도, 한 프레임 이동, 0.25×~1× 재생과 주기 슬라이더를 제공한다. 공유 링크는 각도와 프레임 시점을 저장하며 각 사진의 검토 링크에는 앞선 사진 ID도 담는다. “37개 각도 검사”는 재생 가능 여부와 반대 발 대응이 더 유리한 선택을 검사한다.

`reference-motion.test.ts`는 가져온 GLB의 해시·클립 이름·스킨을 확인하고, 실제 AnimationMixer가 출력하는 원본 관절 및 발 메시의 정점과 매칭용 JSON을 대조한다. `reference-sequencer.test.ts`는 37방향에서 각각 최소 60주기(약 2,001프레임)를 재생해 반대 발 대응, 한 주기 내 원본 사진 재사용, 원본 연속성, 방향 범위, 독립 시계와 표시 이력을 검사한다. 모든 5,355개 사진 특징이 원본 디버그 관절의 같은 좌우 이름에서 왔는지도 대조한다. 역전된 발의 사진을 가까운 위치로 받아들이지 않는 회귀 사례, 방향 변경·드래그·부분 구간·정지 상태 조작도 검사한다. 드래그 테스트는 상주 사진도 같은 3D 선택기와 버전을 쓰는지 검사한다.

디버그의 37각도 검사는 실제 재생 선택기로 각 300프레임을 재현하고 인물 내부·인물 교체·주기 경계 전환을 모두 측정한다. `motion-quality.ts`의 고정 기준은 512×768 사진에서 같은 발의 3D 예상 이동을 뺀 잔차 P95 24px·최대 48px, 몸 기울기 P95 3°·최대 6°, 몸통 중심 P95 12px·최대 24px다. 신뢰도 0.6 이상인 발 지점이 두 개 미만이면 발 측정 불가로 표시하며 0으로 계산하지 않는다. 발과 몸통 기울기 측정률은 각각 95% 이상이어야 하고, 한 착장의 연속 등장 시간은 3프레임이어야 한다. `pnpm check:runway-motion`은 방향마다 1,200프레임을 검사하며 미달 방향이 하나라도 있으면 실패 종료한다. 기존 해부학적 대응 테스트 통과와 이 시각적 연속성 기준 통과는 별개의 결과다. 기준 통과만으로 누끼나 방향이 정확하다고 판정하지 않는다.

자동 검사는 관절 추정이 실제 사람의 좌우를 항상 맞혔다는 보증은 아니다. 원본 → 등록 사진 → 실제 재생을 정속과 느린 재생으로 비교하고, 특히 한 발이 앞으로 나왔을 때 비슷한 위치의 반대 발로 바뀌지 않는지 본다. 발 위치가 가까운 정지 사진 한 쌍이나 일정한 FPS만으로 보행의 자연스러움을 판정하지 않는다.

```sh
.cache/runway-walk/venv/bin/python scripts/runway-walk/debug-poses.py --cache .cache/runway-walk --output pages/runway-walk
node scripts/runway-walk/import-reference.mjs .cache/runway-walk/reference/UAL1_Standard.glb
node scripts/runway-walk/fit-reference.mjs pages/runway-walk
node scripts/runway-walk/build-schedule.mjs pages/runway-walk .qa/runway-schedule.json
.cache/runway-walk/venv/bin/python scripts/runway-walk/drag-previews.py --output pages/runway-walk
pnpm test pages/runway-walk
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

초기 MP4 비교 시안에서는 좌우 발목 높이 차이에 주기 함수를 맞춰 보행 위상과 방향을 추정한다. 파란 스웨터 구간(276초)의 보행을 기준으로 무릎·발목·발 모양과 이전 자세의 차이를 함께 비교한다. 30프레임 주기를 여섯 번 진행하며 최근 사용한 인물은 잠시 제외한다. 얼굴이나 의상을 생성하거나 몸을 변형하지 않는다.

자동 마스크라 머리카락·가방·발 주변에 약한 테두리나 누락이 남는다. 사람마다 보폭과 팔 동작이 달라 자세가 완전히 일치하지는 않는다. 3프레임 버전은 선택한 구간 안에서 원본 프레임이 실제로 연속되는지 검사한다. 프레임 교체와 마스크의 최종 판단은 실제 재생 화면으로 한다.

## 두 가지 추가 시안

색 버전은 의상 색을 보고 정한 인물 순서의 가까운 세 후보 안에서 걸음이 맞는 프레임을 고른다. 골반과 다리 길이의 정렬은 기존 시안과 공유한다. 빠른 인물 교체 안에 큰 색의 흐름이 생기도록 한 편집 규칙이며, 색을 다시 칠하거나 인물 사이를 겹쳐 녹이지 않는다.

발 디딤 버전은 자동 주기 추정만으로 컷을 정하지 않는다. `scripts/runway-walk/footfalls.json`에 원본 신발과 바닥의 접촉을 직접 확인한 시작·끝 프레임을 기록했다. `foot`은 화면 방향이 아닌 사람의 왼발·오른발이다. 시작부터 다음 반대 발 접촉 직전까지 원본의 순서를 유지하며, 한 구간을 15프레임(0.6초)으로 맞춰 중복 또는 생략 샘플링한다. 각 컷에서는 좌우 발이 번갈아 닿는다. 바닥 높이 차이를 줄이기 위해 인물 전체의 세로 위치도 맞춘다.

일부 프레임은 가려진 관절의 신뢰도가 낮아 첫 추출에서 빠졌다. 수동으로 확인한 발 디딤 구간만 다시 추출해 `poses-contact.json`에 보관하며, 기존 `poses.json`과 분리한다. 배경 사람과 겹치는 검은 가죽 재킷 구간(800초)은 새 두 버전에서 제외했다. 접촉 시점은 25fps 영상에서의 시각적 판단이므로 정밀한 보행 측정값은 아니다.

보정 편집을 검토할 때는 `build-schedule.mjs`의 출력 경로와 대상 각도 뒤에 `--register`를 붙인다. 이 방식은 3D 동작의 같은 시점에 맞춰 사진 전체의 크기를 ±6%, 기울기를 ±2.5°, 위치를 각 축 ±10px 이내에서 정렬한다. 팔다리 비율과 좌우 대응은 그대로 유지한다. `registration.yaws`에 명시한 검증 편집에만 적용하며 기존 승인 각도는 원래 배치를 보존할 수 있다. 작품, 모델 비교, 관절 표시와 수치 검사는 같은 변환을 사용한다. 새 보정 편집은 실제 신발·머리 경계와 전체 반복 재생을 확인한 후 설치한다.
