# Enrico Tartarotti 채널 조사

조사일: 2026-10-25 · [원본 채널](https://www.youtube.com/@enricotartarotti)

## 범위와 확인 수준

공개 Videos·Shorts 탭의 전체 목록을 조회해 긴 영상 87편과 쇼츠 24편, 중복 없는 111편을 확보했습니다. 합산 길이는 약 18시간 19분입니다. 공개 목록과 영상별 메타데이터는 111편 모두 확인했고, 영어 자막이 확보된 108편은 자막 발췌·챕터·설명을 기준으로 소재를 분류했습니다. 관련도가 높은 영상은 해당 구간의 연속 자막을 추가로 확인했습니다. 모든 영상을 처음부터 끝까지 시청한 조사는 아닙니다. 비공개·삭제 영상, 멤버 전용 자료, 커뮤니티 게시물과 외부 계정은 범위에 포함하지 않았습니다. 실제 촬영·도식 제작 전에는 선택한 영상의 화면과 공식 구현 자료를 다시 확인합니다.

자막 미확보 3편은 `4i66ht6YHkw`(공개 영어 자막 없음), `Q6BnCTqv0zA`·`zM8VJJUWXQ0`(자막 요청 제한)입니다. 이 3편은 챕터·설명·제목으로만 분류했으며 세부 내용 확인 완료로 취급하지 않습니다. 자동 자막은 인명·제품명·수치를 오인식할 수 있습니다.

원본 자막·설명 전문은 저장소에 복제하지 않습니다. 아래는 조사자의 짧은 요약이며, 실제 카드 원고·캡션은 아닙니다. 제목은 조회 시점의 제목으로, 검색 결과나 과거 공유 링크에 남은 이전 제목과 다를 수 있습니다.

## 발견한 방향

이 채널의 좋은 소재는 기술의 탄생 연도보다 **익숙한 행동 → 예상과 다른 작동 → 그 차이를 만든 제약 → 실제 화면 비교**에 있습니다. 긴 영상 하나에서 독립적인 카드뉴스를 여러 편 꺼낼 수 있습니다. 예를 들어 단순한 버튼도 눌림·뗌·이탈·재진입·입력 허용 영역으로 나뉘고, 지도 확대도 라벨 충돌·우선순위·색 대비라는 여러 문제로 나뉩니다.

사용자 요청에 맞춰 현재의 숨은 동작을 우선하고, 인물 역사·창업·제품 출시 전망·스폰서 소개는 후순위로 뒀습니다. 이미 제작한 Figma 복붙과 Pull to Refresh는 신규 후보에서 제외했습니다. 기존 Notion 레퍼런스의 제목·도입 전개를 참고하되 원문 표현이나 카드를 복제하지 않았습니다.

## 우선 읽을 영상 묶음

| 묶음 | 영상 | 꺼낼 수 있는 소재 |
| --- | --- | --- |
| 입력과 작은 판정 | [The LIES That Make Your Tech ACTUALLY Work](https://www.youtube.com/watch?v=rAVV4kAYlI8), [Notion 팀 인터뷰](https://www.youtube.com/watch?v=b00sgRR_Vc0) | 키보드 입력 영역, 버튼 상태, 메뉴 이동 경로, 체크박스 허용 범위 |
| 화면 아래의 시스템 | [Why Simple Tech is Almost Impossible to Build](https://www.youtube.com/watch?v=qSQZ8B-2nU0), [The Ridiculous Engineering Of Text](https://www.youtube.com/watch?v=7DN3Ectm6UY) | 지도 라벨, 검증 시점, 선행 로딩, 이모지·커서·글꼴 |
| 체감 속도 | [Loading Screens](https://www.youtube.com/watch?v=XqhduyTnEM8), [Animations](https://www.youtube.com/watch?v=z3Lo5QT7nME) | 즉시 반영·작업 큐, 선행 업로드, 중단 가능한 애니메이션, 기다림과 신뢰 |
| 손과 귀의 감각 | [Hardware](https://www.youtube.com/watch?v=wLIgrGAIRsE), [How Your Tech TRICKS You](https://www.youtube.com/watch?v=7nnyv4yJGJc) | 뚜껑·버튼의 힘, 곡률, 재료의 차가움, 음량 곡선 |
| 보이지 않는 제품 선택 | [Messaging](https://www.youtube.com/watch?v=6DSW1rN-ZV4), [Notifications](https://www.youtube.com/watch?v=Dx2yPk0FsGM) | 읽음 표시 기본값, 엔터키, 스레드·온라인 상태, 알림의 내용·시점 |

## 출처를 쓸 때 구분할 것

- 영상의 시연·인터뷰: 아이디어와 당시 제품 동작의 근거입니다. 모든 앱의 보편적인 구현 사실을 증명하지 않습니다.
- 공식 문서·표준·제조사 기술 블로그: 특정 구현과 범위를 확인하는 데 씁니다. 후보 파일에 별도로 연결했습니다.
- 저자의 해석·재설계·추산: 실제 배포 기능, 실험 결과, 회사 내부 의도와 구분합니다.
- 오래된 구현과 현재 제품: Spotify 셔플처럼 모드와 방식이 바뀐 사례는 최신 공식 자료를 우선합니다.
- 보류할 주장: QWERTY를 오직 느리게 치게 만든 배열이라고 설명하는 단정, Google 버튼의 손실액 추산, 모든 제품의 동작을 특정 수치로 일반화하는 표현은 검증 없이 가져오지 않습니다. 곡률 연속성과 superellipse/squircle도 같은 개념으로 단순화하지 않습니다.

## 보관 파일

- [카드뉴스 후보 36개](./enrico-tartarotti-carousel-candidates.md): 우선순위·핵심 질문·시각 자료·영상 구간·추가 검증 항목.
- [전체 영상 목록 CSV](./enrico-tartarotti-video-inventory.csv): 111편의 ID·게시일·길이·URL·확인 수준·요약. 전체 목록의 누락과 중복을 확인하는 기준.

## 전체 콘텐츠 분류

`자막`은 자막 발췌·챕터·설명을 검토했다는 뜻이며, 영상 전체 시청을 뜻하지 않습니다. 긴 영상과 쇼츠가 같은 내용을 다루면 후보에서는 합칩니다.

| 번호 | 구분 | 게시일 | 영상 | 확인 | 내용·처리 |
| --- | --- | --- | --- | --- | --- |
| 001 | 긴 영상 | 2026-10-17 | [The Ridiculous Engineering Of Animations](https://www.youtube.com/watch?v=z3Lo5QT7nME) | 자막 | 앱의 출입 위치, 스프링·이징, 중단 가능한 모션과 로딩을 가리는 애니메이션. |
| 002 | 긴 영상 | 2026-10-02 | [The Insane Design Of Messaging](https://www.youtube.com/watch?v=6DSW1rN-ZV4) | 자막 | 읽음 표시·엔터키·답글 구조·온라인 상태가 대화 행동을 바꾸는 방식. |
| 003 | 긴 영상 | 2026-09-02 | [The Ridiculous Engineering Of Text](https://www.youtube.com/watch?v=7DN3Ectm6UY) | 자막 | 문자 인코딩, 이모지 조합, 글꼴 렌더링과 커서 이동의 복잡성. |
| 004 | 긴 영상 | 2026-08-19 | [The Weird Way Tech Steals From Games](https://www.youtube.com/watch?v=GypAKofWGBk) | 자막 | 히트 스톱·튜토리얼·점진적 공개 등 게임 설계를 소프트웨어에 적용하는 방식. |
| 005 | 긴 영상 | 2026-07-31 | [The LIES That Make Hardware ACTUALLY Work](https://www.youtube.com/watch?v=wLIgrGAIRsE) | 자막 | 이어폰 케이스의 여닫힘, 곡률 연속성, 버튼 힘과 재료의 촉감. |
| 006 | 긴 영상 | 2026-07-08 | [The Ridiculous Engineering Of Notifications](https://www.youtube.com/watch?v=Dx2yPk0FsGM) | 자막 | 알림의 내용·시점·맥락 최적화와 운영체제의 요약이 만드는 변화. |
| 007 | 긴 영상 | 2026-06-23 | [The Weird Future Of User Interfaces](https://www.youtube.com/watch?v=f32W5BEzWN0) | 자막 | 챗봇·기존 GUI·생성형 UI의 역할과 직접 조작의 가치. |
| 008 | 긴 영상 | 2026-06-09 | [The Ridiculous Engineering Of Figma (ft. Figma Team)](https://www.youtube.com/watch?v=5t8dh3DSdBk) | 자막 | 복붙·다중 선택·개인별 undo·협업 충돌·새 UI의 학습 가능성. |
| 009 | 긴 영상 | 2026-05-07 | [The Ridiculous Engineering Of YouTube Videos](https://www.youtube.com/watch?v=giP1iIbSVh0) | 자막 | 미리보기·미니플레이어·연속 재생과 영상을 조각내 전달하는 구조. |
| 010 | 긴 영상 | 2026-04-14 | [Why Everyone is Suddenly OBSESSED With Claude Code](https://www.youtube.com/watch?v=gzt52Trk9w0) | 자막 | 에이전트 코딩의 반복 피드백, 범용 인터페이스와 도구 사용. |
| 011 | 긴 영상 | 2026-03-27 | [The Most Important Tiny Decision In Tech History](https://www.youtube.com/watch?v=7EVZpW9Rdwk) | 자막 | 탭과 스크롤을 구별하는 대기·이동 임계값 및 입력 장치별 UI 차이. |
| 012 | 긴 영상 | 2026-03-20 | [The Ridiculous Engineering of Loading Screens](https://www.youtube.com/watch?v=XqhduyTnEM8) | 자막 | 즉시 반영·작업 큐·선행 업로드·진행률 추정·기다림의 신뢰 효과. |
| 013 | 긴 영상 | 2026-02-28 | [The Weird Reason Your Tech Stays Broken](https://www.youtube.com/watch?v=-51ocAD6zBI) | 자막 | 표준화·호환성·기존 사용자 기대가 불편한 기술을 유지시키는 이유. |
| 014 | 긴 영상 | 2026-02-20 | [The Ridiculous Engineering Of Short Form Content](https://www.youtube.com/watch?v=69Gw7aoWMMI) | 자막 | 세로 피드의 화면 구성·제스처·로딩·콘텐츠 제작과 추천 신호의 연결. |
| 015 | 긴 영상 | 2026-01-25 | [Why Our Tech Got Silent](https://www.youtube.com/watch?v=_rFJutK25VU) | 자막 | 기능적 효과음에서 햅틱·브랜드 사운드로 이동하는 피드백. |
| 016 | 긴 영상 | 2026-01-20 | [The 7 Levels of Tech Design](https://www.youtube.com/watch?v=FQVRfadJkJk) | 자막 | 세부 시각 요소부터 상호작용·제품 구조·기본값·사업 모델까지의 설계 층위. |
| 017 | 긴 영상 | 2025-12-14 | [How ChatGPT Is Weirdly Turning Into Facebook](https://www.youtube.com/watch?v=C7Z11ghwevQ) | 자막 | 검색과 대화형 서비스의 비용·맥락·유통·사업 모델 비교. |
| 018 | 긴 영상 | 2025-12-05 | [Why Simple Tech is Almost Impossible to Build](https://www.youtube.com/watch?v=qSQZ8B-2nU0) | 자막 | 자판 팝업 예외, 검증 시점, 댓글 토글, 지도 라벨 배치와 선행 로딩. |
| 019 | 긴 영상 | 2025-11-15 | [How Silicon Valley KILLED Fun](https://www.youtube.com/watch?v=DYdLq9icgrI) | 자막 | 기술 제품에서 장난기와 개성이 사라지고 다시 등장하는 배경. |
| 020 | 긴 영상 | 2025-10-17 | [How Your Tech Is Built For You To FAIL](https://www.youtube.com/watch?v=4HWPFd8CQo8) | 자막 | 보내기 취소·undo·자동 저장·오류 예방 등 실수를 허용하는 설계. |
| 021 | 긴 영상 | 2025-09-25 | [Tech's WEIRDEST Problem](https://www.youtube.com/watch?v=dQe1r2MOwt8) | 자막 | 무료 서비스의 비용과 기대, 구독·사용량 요금의 심리. |
| 022 | 긴 영상 | 2025-09-07 | [The Weird Death Of User Interfaces](https://www.youtube.com/watch?v=KG4ONHqF1qg) | 자막 | 명령·직접 조작·음성·생성형 UI의 조합과 정보 표시의 한계. |
| 023 | 긴 영상 | 2025-07-14 | [How YouTube is DESIGNED To Make YouTubers QUIT](https://www.youtube.com/watch?v=lGZvhW27WX0) | 자막 | 조회·클릭률·순위·댓글과 창작자의 행동·번아웃의 관계. |
| 024 | 긴 영상 | 2025-06-24 | [The Ridiculous Engineering Of Notion (ft. Notion Team)](https://www.youtube.com/watch?v=b00sgRR_Vc0) | 자막 | 체크박스의 허용 영역, 메뉴·키보드 탐색·숫자 정렬·점진적 공개. |
| 025 | 긴 영상 | 2025-05-21 | [Why Tech Gets Terrible When It Gets Popular](https://www.youtube.com/watch?v=BQLVgmhgtpQ) | 자막 | 사용자층 확대와 신규 사용자 최적화가 기존 사용자 경험에 미치는 영향. |
| 026 | 긴 영상 | 2025-05-07 | [Behind The Scenes Of Lovable's Insane Design (ft. Lovable Team)](https://www.youtube.com/watch?v=ZoVLS-Wxr1s) | 자막 | Lovable 팀 인터뷰: 시각적 피드백·코드 노출·제작 과정의 설계. |
| 027 | 긴 영상 | 2025-03-15 | [Why EVERYONE Is OBSESSED With Figma](https://www.youtube.com/watch?v=0jze5RbyoW4) | 자막 | Figma의 인지 부하·협업 흐름·브라우저 기술 기반. |
| 028 | 긴 영상 | 2025-02-14 | [People Still Don't Understand AI](https://www.youtube.com/watch?v=r87NGV1Lgao) | 자막 | AI 모델·오픈소스·인프라와 제품 가치의 구별. |
| 029 | 긴 영상 | 2025-01-24 | [Social Media Is Broken... (But We Can Fix It)](https://www.youtube.com/watch?v=HqYIUV7Eqjk) | 자막 | 소셜 피드의 제약과 선택권을 되돌리려는 저자의 재설계 제안. |
| 030 | 긴 영상 | 2024-12-04 | [The Reason Everyone's OBSESSED With Spotify Wrapped](https://www.youtube.com/watch?v=EuzRWd5U6_I) | 자막 | Spotify Wrapped의 개인 데이터·호기심·기대·공유를 연결하는 전개. |
| 031 | 긴 영상 | 2024-11-16 | [How Your Tech TRICKS You](https://www.youtube.com/watch?v=7nnyv4yJGJc) | 자막 | 음량 곡선·낮은 기술의 해법·진행률·성형 재료·노이즈 등 감각 설계. |
| 032 | 긴 영상 | 2024-10-27 | [How Tech Secretly KILLED Choice](https://www.youtube.com/watch?v=UdzT1YxeZsY) | 자막 | 연동의 편리함과 생태계 종속·기본 서비스·기기 간 마찰. |
| 033 | 긴 영상 | 2024-10-16 | [Why Ugly Things Are Cool Now](https://www.youtube.com/watch?v=q1SWw7i9LQc) | 자막 | 완벽함이 쉬워진 환경에서 불완전한 미감이 갖는 신호 가치. |
| 034 | 긴 영상 | 2024-10-07 | [I Quit My 6-Figures Dream Job In Tech..](https://www.youtube.com/watch?v=UbFufWfJPZ8) | 자막 | 퇴사·기회·위험·소득 레버리지에 대한 개인 커리어 이야기. |
| 035 | 긴 영상 | 2024-09-29 | [The Internet Wants Your Money. Here's How To Outsmart It](https://www.youtube.com/watch?v=4OLt9pFlRvo) | 자막 | 구매 단계의 사회적 증거·보상·매몰 비용·현금 없는 결제. |
| 036 | 긴 영상 | 2024-09-15 | [How Smartphones KILLED Photography](https://www.youtube.com/watch?v=oHKgXxcpo4k) | 자막 | 센서의 물리적 제약과 계산 사진·생성형 편집의 경계. |
| 037 | 긴 영상 | 2024-09-03 | [What Happened To Physical Tech?](https://www.youtube.com/watch?v=TIFF-rinlbo) | 자막 | 물리 버튼의 감각과 터치스크린의 수정 가능성·제조상의 이점. |
| 038 | 긴 영상 | 2024-08-28 | [What if Smartphones Never Existed?](https://www.youtube.com/watch?v=AJ8OnNQYAVo) | 자막 | 스마트폰·소셜미디어·개인 컴퓨터가 없는 가상 역사 사고 실험. |
| 039 | 긴 영상 | 2024-07-21 | [How Apple Stole "AI" From Everyone Else](https://www.youtube.com/watch?v=gV1f-lS0C9g) | 자막 | Apple의 AI 전략·기본값·앱 연결에 대한 당시 분석. |
| 040 | 긴 영상 | 2024-07-10 | [What Happened To User Interfaces?](https://www.youtube.com/watch?v=HdozqSVF-VM) | 자막 | 스큐어모피즘·평면화·디자인 패턴과 다시 등장하는 시각적 표현. |
| 041 | 긴 영상 | 2024-05-28 | [What Happens Now That We All HATE Using Our Phone?](https://www.youtube.com/watch?v=2LpR9zhEl2A) | 자막 | 스마트폰 피로와 제품의 참여 지표·디지털 미니멀리즘. |
| 042 | 긴 영상 | 2024-05-19 | ["AI" Has A Huge Problem](https://www.youtube.com/watch?v=CY_b8w8u9NY) | 자막 | 모든 AI를 채팅창으로 만드는 문제와 기존 작업 흐름에 통합하는 제안. |
| 043 | 긴 영상 | 2024-04-24 | [The Most Dangerous App That EVERYONE Loves](https://www.youtube.com/watch?v=P2qOiKA56tI) | 자막 | 지도의 데이터·경로·장소 노출이 현실 행동을 유도하는 영향. |
| 044 | 긴 영상 | 2024-03-13 | [Why You Don't Reply To Your Friends](https://www.youtube.com/watch?v=NVjRPwneLiI) | 자막 | 답장 부담, 사람 중심의 알림, 업무와 개인 대화의 경계. |
| 045 | 긴 영상 | 2024-03-04 | [The SECRETS That Make Your Phone ACTUALLY Work](https://www.youtube.com/watch?v=-YVtZV4DjCE) | 자막 | 배터리 잔량 추정·커서 이동·셔플·곡선·글꼴 렌더링 등 일상의 숨은 시스템. |
| 046 | 긴 영상 | 2024-02-16 | [The War To Put Apps In Front Of Your Eyes](https://www.youtube.com/watch?v=ETk5I99d8nc) | 자막 | 앱·웹·스토어·공간 컴퓨팅을 둘러싼 플랫폼 통제. |
| 047 | 긴 영상 | 2024-02-02 | [The Weird Rise Of Anti-Startups](https://www.youtube.com/watch?v=xL1MOOD5Ox8) | 자막 | 소규모 팀·단순 제품·지속 가능한 사업을 택한 반스타트업 사례. |
| 048 | 긴 영상 | 2024-01-16 | [Is This USELESS?](https://www.youtube.com/watch?v=dWEjDIsMFB0) | 자막 | Rabbit R1과 에이전트 도구의 당시 데모·입력 방식·실효성 비평. |
| 049 | 긴 영상 | 2023-12-30 | [The LIES That Make Your Tech ACTUALLY Work](https://www.youtube.com/watch?v=rAVV4kAYlI8) | 자막 | 키보드의 동적 입력 영역·버튼 상태·커서·중단 가능한 모션·포인터 목표. |
| 050 | 긴 영상 | 2023-12-06 | [Why Half The World Uses WhatsApp](https://www.youtube.com/watch?v=1O1u0UO99NE) | 자막 | WhatsApp의 세계 시장·전화번호 기반 연결·사용 환경에 맞춘 제품 전략. |
| 051 | 긴 영상 | 2023-11-18 | [How Italy (Almost) Became Silicon Valley](https://www.youtube.com/watch?v=86kXVggNQbo) | 자막 | Olivetti의 산업·컴퓨터 개발 역사와 생태계의 조건. |
| 052 | 긴 영상 | 2023-11-11 | [We NEED To Talk About The AI Pin](https://www.youtube.com/watch?v=E2-L-Gv0wr0) | 자막 | Humane AI Pin의 당시 발표·사용 흐름·오류와 제품 적합성 비평. |
| 053 | 긴 영상 | 2023-11-04 | [Why Everyone Is OBSESSED With Arc Browser](https://www.youtube.com/watch?v=UdopamaLJC8) | 자막 | Arc의 탭·공간·개인화·초대 전략과 사업적 불확실성. |
| 054 | 긴 영상 | 2023-10-24 | [Smartphones Are Dead (But We FINALLY Know What's Next)](https://www.youtube.com/watch?v=pB6TdukUsAg) | 자막 | 스마트폰 이후의 AR·AI 입력 장치에 대한 당시 전망. |
| 055 | 긴 영상 | 2023-10-04 | [How I (Finally) Fixed My Digital Life](https://www.youtube.com/watch?v=7PhEfKCHr7Y) | 자막 | 알림 줄이기·기본값 점검·사진·이메일 정리 등 개인 운영법. |
| 056 | 긴 영상 | 2023-09-10 | [The Real Reason Your Tech Makes You Unhappy](https://www.youtube.com/watch?v=Vbg5TeoLTW0) | 자막 | 참여율 등 측정 가능한 지표와 사용자의 행복이 갈라지는 문제. |
| 057 | 긴 영상 | 2023-07-12 | [The Best Tech Product Ever Designed](https://www.youtube.com/watch?v=n1cMrkMqmnw) | 자막 | 주방 저울을 사례로 본 단순한 목적·물리적 피드백·도구의 집중성. |
| 058 | 긴 영상 | 2023-06-25 | [Apple Built The Vision Pro To FAIL, And It's Genius](https://www.youtube.com/watch?v=fNEni_DP4fY) | 자막 | 초기 Vision Pro의 가격·대상 사용자·생태계 구축에 대한 당시 해석. |
| 059 | 긴 영상 | 2023-05-02 | [Short Form Content Is BROKEN. Can We Fix It?](https://www.youtube.com/watch?v=1F85wJmhDkA) | 자막 | 쇼츠의 발견과 선택·창작자 수익·긴 영상 연결을 둘러싼 재설계. |
| 060 | 긴 영상 | 2023-04-17 | [YouTube Does This Anytime You Watch ..And You Don't Realize It](https://www.youtube.com/watch?v=49_a3jkdBdI) | 자막 | 재생 요청·영상 분할·화질 전환·인코딩과 스트리밍 인프라. |
| 061 | 긴 영상 | 2023-04-04 | [Why Luxury Apps Don't Exist?](https://www.youtube.com/watch?v=X1HqzLbGznc) | 자막 | 명품의 장인성·희소성·가격 논리를 앱에 적용할 때의 차이. |
| 062 | 긴 영상 | 2023-03-17 | [Why Japan Is Living In A Weird Retro Future](https://www.youtube.com/watch?v=zgV8bJy5s34) | 자막 | 일본의 물리적 기술·현금·로봇과 소프트웨어 경험의 간극. |
| 063 | 긴 영상 | 2023-02-24 | [Uh Oh.. Did AI Just KILL Websites?](https://www.youtube.com/watch?v=AOSu6jSMq0M) | 자막 | 대화형 검색이 웹 광고·출판·출처·플랫폼에 미칠 영향에 대한 당시 전망. |
| 064 | 긴 영상 | 2023-02-17 | [What ACTUALLY Happens When You Blow Up On YouTube?](https://www.youtube.com/watch?v=0V25aY4TM4I) | 자막 | 채널 성장 후 수익·스폰서·피싱·기회·심리 변화에 대한 개인 경험. |
| 065 | 긴 영상 | 2023-01-31 | [Why Everyone Is OBSESSED With Notion](https://www.youtube.com/watch?v=aWGviOMQqSw) | 자막 | Notion의 블록·직접 조립·IKEA 효과·제품 주도 성장. |
| 066 | 긴 영상 | 2023-01-18 | [Who Is REALLY Making Billions From ChatGPT](https://www.youtube.com/watch?v=fHMNYnjuXak) | 자막 | 초기 ChatGPT·Microsoft 투자·AI 인프라와 검색 사업의 관계. |
| 067 | 긴 영상 | 2023-01-09 | [Do You Have a GENIUS Startup Idea?](https://www.youtube.com/watch?v=HABFEs90MZ8) | 자막 | 창업 아이디어보다 문제·대상·검증·인터뷰를 먼저 다루는 방법. |
| 068 | 긴 영상 | 2022-12-02 | [ChatGPT is Frighteningly Good](https://www.youtube.com/watch?v=2lzQD-7lZJU) | 자막 | 출시 초기 ChatGPT의 활용·검색 대비 차이·한계·전망. |
| 069 | 긴 영상 | 2022-10-31 | [Why Google Maps Doesn't Show You Unsafe Areas](https://www.youtube.com/watch?v=4i66ht6YHkw) | 제한 | 지도에 위험 지역을 표시하는 설계 제안. 자막이 없어 챕터·설명만 확인. |
| 070 | 긴 영상 | 2022-10-09 | [AI Generated Videos Are Scary](https://www.youtube.com/watch?v=Es01hmaXux0) | 자막 | 초기 생성형 영상 사례와 도구·창작자의 역할 변화. |
| 071 | 긴 영상 | 2022-08-31 | [Airbnb Just Hacked The Travel Industry (Again)](https://www.youtube.com/watch?v=OwiztfnZwE4) | 자막 | Airbnb 카테고리 재설계와 사용자가 해결하려는 일의 관점. |
| 072 | 긴 영상 | 2022-07-17 | [Ads Are Coming To Your Lockscreen (For Real)](https://www.youtube.com/watch?v=SQ_hBlGNR4c) | 자막 | 잠금화면 광고와 무료·저가 제품의 수익 모델. |
| 073 | 긴 영상 | 2022-06-22 | [The Man Who Made Apple Possible (In 1968)](https://www.youtube.com/watch?v=BXSHJXHeaqM) | 자막 | Engelbart·Xerox 등 상호작용 컴퓨팅 역사. |
| 074 | 긴 영상 | 2022-06-07 | [I Redesigned YouTube's Worst New Feature](https://www.youtube.com/watch?v=ELoNeW7GKog) | 자막 | YouTube 다시 본 구간 그래프의 의미와 저자의 개선·실험 제안. |
| 075 | 긴 영상 | 2022-05-26 | [The Boring Tech To Make AR Glasses Cool](https://www.youtube.com/watch?v=nkCfdHdHnKg) | 자막 | AR 안경의 위치·방향 정합을 가능하게 하는 VPS와 현실 지도. |
| 076 | 긴 영상 | 2022-05-02 | [The First "A.I." That Really Scared Me](https://www.youtube.com/watch?v=tZdHxkx4i4w) | 자막 | 초기 이미지 생성 AI의 결과와 창작·플랫폼에 대한 전망. |
| 077 | 긴 영상 | 2022-04-13 | [Famous Apps Looked Like THIS](https://www.youtube.com/watch?v=_Sn8Glj5NW4) | 자막 | Twitch·Spotify·Coinbase·Netflix의 초기 제품과 변화. |
| 078 | 긴 영상 | 2022-04-01 | [Why Google Maps Is The Most Important Tech Product Of The 2020s](https://www.youtube.com/watch?v=bCvpoHxSVIE) | 자막 | 디지털 지도·장소 노출·AR를 연결하는 실제 세계의 데이터 기반. |
| 079 | 긴 영상 | 2022-03-10 | [You Control This Video's Thumbnail](https://www.youtube.com/watch?v=Pol6UGKZpdY) | 자막 | 시청자 댓글로 영상의 썸네일·제목을 바꾸는 상호작용 실험. |
| 080 | 긴 영상 | 2022-02-10 | [The Sneaky Psychology Of Loading Screens](https://www.youtube.com/watch?v=g8uhdyLTAvY) | 자막 | 진행 막대·스피너·스켈레톤과 체감 대기 시간. |
| 081 | 긴 영상 | 2021-12-28 | [The Spotify Shuffle Button is a Lie](https://www.youtube.com/watch?v=NhAIA-o7f4M) | 자막 | 반복을 포함하는 무작위와 사용자가 무작위로 느끼는 재생 순서의 차이. |
| 082 | 긴 영상 | 2021-12-04 | [What If YouTube Removes The Views Count?](https://www.youtube.com/watch?v=chyB9Ot9QK8) | 자막 | 조회수 지표·추천·사회적 증거와 선택에 대한 재설계 제안. |
| 083 | 긴 영상 | 2021-11-09 | [The Issue With Being A Multipotentialite](https://www.youtube.com/watch?v=XQVWM2P3o24) | 자막 | 여러 관심사·비교·운·진로 선택에 대한 개인적 조언. |
| 084 | 긴 영상 | 2021-10-19 | [How Notifications Are Messing With Your Life](https://www.youtube.com/watch?v=OXqpy_H8onc) | 자막 | 알림의 습관 고리·시점·내용과 주의 전환 비용. |
| 085 | 긴 영상 | 2021-10-03 | [Reacting to Innovative Ideas From Reddit](https://www.youtube.com/watch?v=82E7VoxCPc0) | 자막 | Reddit의 제품 아이디어를 문제·대상·차별화 관점에서 평가. |
| 086 | 긴 영상 | 2021-09-28 | [How I'm Saving My Dying YouTube Channel](https://www.youtube.com/watch?v=PaGAVBBCv6s) | 자막 | 채널 성과와 제작 방식·기획 개선에 대한 개인 기록. |
| 087 | 긴 영상 | 2021-08-24 | [I'm Switching to English (and Starting From Scratch)](https://www.youtube.com/watch?v=Q6BnCTqv0zA) | 제한 | 시청자에게 의견을 구하는 채널 소통 영상. 영어 자막 수집 제한으로 제목·설명만 확인. |
| 088 | 쇼츠 | 2026-06-03 | [I built this. Please steal it!](https://www.youtube.com/shorts/_RHiFAxISuM) | 자막 | 일정 시간 안의 연속 키 입력을 이용해 텍스트 입력 의도를 추정하는 저자의 Flask 제안. |
| 089 | 쇼츠 | 2026-01-22 | [Small Details Mean Mode Than You Think #ad](https://www.youtube.com/shorts/TB1W7mEIHSQ) | 자막 | 체크박스·라디오 버튼의 모양이 선택 가능 개수를 전달하는 관습. 광고 포함. |
| 090 | 쇼츠 | 2025-12-13 | [Your Phone's Keyboard Is A Lie](https://www.youtube.com/shorts/eyQCSaFbdOY) | 자막 | 자판 글자 팝업과 스페이스바에서 팝업을 생략하는 차이. |
| 091 | 쇼츠 | 2025-12-09 | [#ad There's One Rule On The Internet](https://www.youtube.com/shorts/s3vfN9tWLoY) | 자막 | 참여·창작 비율을 도입으로 Snapchat Lens Studio를 소개하는 광고. |
| 092 | 쇼츠 | 2025-09-30 | [My Weird Way To Make Motion Graphics](https://www.youtube.com/shorts/FKBJ7Q2Fuhs) | 자막 | 모션 그래픽을 조절 가능한 웹 앱으로 만드는 Bolt 제작 광고. |
| 093 | 쇼츠 | 2025-08-13 | [Human vs. AI vs. Human + AI #ad](https://www.youtube.com/shorts/zM8VJJUWXQ0) | 제한 | 사람·AI·결합 제작 비교 광고. 영어 자막 수집 제한으로 제목·설명만 확인. |
| 094 | 쇼츠 | 2025-08-10 | [I Redesigned Shorts](https://www.youtube.com/shorts/p2NUbrGTsB8) | 자막 | 쇼츠에 선택권을 추가하려는 저자의 재설계. 실제 서비스 기능과 구분. |
| 095 | 쇼츠 | 2025-05-28 | [Why Star Wars Shouldn't Exist](https://www.youtube.com/shorts/psSuEAL7HVE) | 자막 | Star Wars 시각화 이야기를 도입으로 LTX Studio를 소개하는 광고. |
| 096 | 쇼츠 | 2025-05-20 | [This Detail in Google's Keynote Just Showed Something Big..](https://www.youtube.com/shorts/AMSWUsYqlMQ) | 자막 | Google 발표의 geospatial API에서 AR 안경의 위치 정합 인프라를 읽는 분석. |
| 097 | 쇼츠 | 2025-05-07 | [Phone Cameras Don't Capture Reality Anymore](https://www.youtube.com/shorts/oVgqycpxiLA) | 자막 | Add Me·생성형 편집과 사진이 현실·기억을 표현하는 방식의 차이. |
| 098 | 쇼츠 | 2025-05-04 | [Why The "Bad" Aesthetic Is Everywhere](https://www.youtube.com/shorts/63S5gFsVaIU) | 자막 | 저화질·불완전한 광고 미감이 신호가 되는 배경. |
| 099 | 쇼츠 | 2025-05-03 | [The Secret Behind Solitaire](https://www.youtube.com/shorts/YNTNV-Am6IY) | 자막 | Solitaire를 마우스 조작 학습과 연결하는 설명. 역사적 의도는 추가 검증 대상. |
| 100 | 쇼츠 | 2025-05-02 | [Why Everything Became A Touchscreen](https://www.youtube.com/shorts/Tw0eQ-FoN74) | 자막 | 물리적 복잡성이 화면 속 조작으로 옮겨 가는 터치스크린의 경제성. |
| 101 | 쇼츠 | 2025-04-03 | [What's Hiding Behind Your Buttons?](https://www.youtube.com/shorts/BGWnz8FVS1U) | 자막 | 버튼의 눌림·뗌·이탈·재진입 상태와 입력 허용 영역. |
| 102 | 쇼츠 | 2025-03-18 | [Why Everyone Is Obsessed With Notion #ad](https://www.youtube.com/shorts/OrPluZnm3nw) | 자막 | Notion을 직접 조립하는 경험과 IKEA 효과를 연결하는 광고. |
| 103 | 쇼츠 | 2025-03-03 | [The Secret Behind The Nintendo Switch](https://www.youtube.com/shorts/2lZFNSi1qRE) | 자막 | Joy-Con 그립에서 표시등의 빛을 전달하는 수동 광학 구조라는 설명. |
| 104 | 쇼츠 | 2025-03-01 | [A Nintendo PlayStation?](https://www.youtube.com/shorts/aV7-8t4v8JE) | 자막 | Nintendo와 Sony의 협업 결렬을 다루는 게임기 역사. |
| 105 | 쇼츠 | 2025-02-27 | [Why Is The I'm Feeling Lucky Button Even Here?](https://www.youtube.com/shorts/bkGJZDsJvXs) | 자막 | Google 검색 버튼의 브랜드 역할. 손실액은 저자의 가정 계산이므로 그대로 인용하지 않음. |
| 106 | 쇼츠 | 2025-02-14 | [Why Is NVidia Even Here?](https://www.youtube.com/shorts/YLBTORLsjt8) | 자막 | GPU·CUDA·AI 연산의 연결을 요약. 시가총액 수치는 당시 사건. |
| 107 | 쇼츠 | 2025-01-18 | [Your Phone's Volume Is a LIE](https://www.youtube.com/shorts/fBdxtU6JN6M) | 자막 | 음량 슬라이더와 물리적 출력·청각 지각의 비선형 관계. |
| 108 | 쇼츠 | 2024-10-17 | [Your Phone's Keyboard Is A LIE](https://www.youtube.com/shorts/ylFXKeTVbec) | 자막 | 문맥에 따라 달라지는 키보드의 보이지 않는 입력 판정 영역. |
| 109 | 쇼츠 | 2023-07-01 | [All this for 10 seconds of video #behindthescenes](https://www.youtube.com/shorts/NzMoilfczB8) | 자막 | Vision Pro 영상 도입의 로토스코핑·합성·모션 제작 과정. |
| 110 | 쇼츠 | 2023-05-31 | [If Star Wars came out in the age of Shorts](https://www.youtube.com/shorts/QeMBuM9ApQA) | 자막 | Star Wars를 쇼츠 형식으로 재구성한 패러디. |
| 111 | 쇼츠 | 2023-01-04 | [I fixed YouTube Shorts' biggest problem #shorts](https://www.youtube.com/shorts/0xryg-DAPhI) | 자막 | 쇼츠와 긴 영상을 연결하는 저자의 제품 제안. 현재 기능과 시점을 분리. |
