"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Section = "home" | "students" | "economy" | "store" | "settings" | "activity" | "queue";
type Student = { id: string; name: string; group: string; balance: number; avatar: string; color: string; job: string };
type Activity = { id: number; student: string; action: string; amount: number; time: string; kind: "earn" | "spend" | "system" };
type Product = { id: number; name: string; category: string; price: number; stock: number; icon: string; color: string };

const initialStudents: Student[] = [
  { id: "s-01", name: "햇살", group: "구름 모둠", balance: 1250, avatar: "☀️", color: "#fff0bc", job: "도서 도우미" },
  { id: "s-02", name: "단풍", group: "별 모둠", balance: 980, avatar: "🍁", color: "#ffe0d4", job: "정리 대장" },
  { id: "s-03", name: "구름", group: "바다 모둠", balance: 1460, avatar: "☁️", color: "#e2ebff", job: "기록 기자" },
  { id: "s-04", name: "초롱", group: "구름 모둠", balance: 720, avatar: "✨", color: "#f4e5ff", job: "식물 지킴이" },
  { id: "s-05", name: "파도", group: "바다 모둠", balance: 1830, avatar: "🌊", color: "#d8f2f2", job: "환경 지킴이" },
  { id: "s-06", name: "다람", group: "별 모둠", balance: 640, avatar: "🐿️", color: "#f6e9d6", job: "준비물 도우미" },
  { id: "s-07", name: "새싹", group: "구름 모둠", balance: 1110, avatar: "🌱", color: "#e4f2d5", job: "식물 지킴이" },
  { id: "s-08", name: "별빛", group: "바다 모둠", balance: 890, avatar: "⭐", color: "#fff4c9", job: "기록 기자" },
];
const initialProducts: Product[] = [
  { id: 1, name: "자리 바꾸기권", category: "교실 권리", price: 250, stock: 4, icon: "🪑", color: "#fff0d6" },
  { id: 2, name: "선생님과 산책", category: "함께하기", price: 500, stock: 3, icon: "🚶", color: "#e2f2e7" },
  { id: 3, name: "숙제 하루 쉬기", category: "교실 권리", price: 800, stock: 2, icon: "📚", color: "#e8e6ff" },
  { id: 4, name: "칭찬 우체통", category: "마음 나눔", price: 150, stock: 8, icon: "💌", color: "#ffe5eb" },
];
const startingActivity: Activity[] = [
  { id: 1, student: "파도", action: "환경 지킴이 급여", amount: 100, time: "오전 9:10", kind: "earn" },
  { id: 2, student: "햇살", action: "자리 바꾸기권 구매", amount: -250, time: "오전 8:52", kind: "spend" },
  { id: 3, student: "선생님", action: "월요일 아침 잔액 정리", amount: 0, time: "어제", kind: "system" },
];

const navigation: { id: Section; label: string; icon: string; group?: string }[] = [
  { id: "home", label: "학급 홈", icon: "⌂" },
  { id: "students", label: "학생과 모둠", icon: "♧" },
  { id: "economy", label: "계좌와 거래", icon: "◉", group: "우리 반 경제" },
  { id: "store", label: "학급 상점", icon: "⌑" },
  { id: "activity", label: "활동 기록", icon: "▤", group: "운영 도구" },
  { id: "queue", label: "예약 작업", icon: "◷" },
  { id: "settings", label: "학급 설정", icon: "⚙" },
];

function won(value: number) { return `${value.toLocaleString("ko-KR")} 별`; }

export default function SchoolDashboard() {
  const [section, setSection] = useState<Section>("home");
  const [students, setStudents] = useState(initialStudents);
  const [products, setProducts] = useState(initialProducts);
  const [activity, setActivity] = useState(startingActivity);
  const [currency, setCurrency] = useState("별");
  const [className, setClassName] = useState("햇살초 5학년 2반");
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [features, setFeatures] = useState({ economy: true, jobs: true, transfer: true, shop: true, tax: false, investing: false, writing: false, boards: true });
  const [groupFilter, setGroupFilter] = useState("모두");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("schoolnation-demo-v1");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (Array.isArray(data.students)) setStudents(data.students);
      if (Array.isArray(data.products)) setProducts(data.products);
      if (Array.isArray(data.activity)) setActivity(data.activity);
      if (data.className) setClassName(data.className);
      if (data.currency) setCurrency(data.currency);
      if (data.features) setFeatures(data.features);
    } catch { window.localStorage.removeItem("schoolnation-demo-v1"); }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("schoolnation-demo-v1", JSON.stringify({ students, products, activity, className, currency, features }));
  }, [students, products, activity, className, currency, features]);

  const totalMoney = students.reduce((sum, student) => sum + student.balance, 0);
  const avgBalance = students.length ? Math.round(totalMoney / students.length) : 0;
  const groups = ["모두", ...Array.from(new Set(students.map((student) => student.group)))];
  const visibleStudents = useMemo(() => students.filter((student) => (groupFilter === "모두" || student.group === groupFilter) && student.name.includes(search)), [students, groupFilter, search]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  function updateBalance(id: string, amount: number, label: string) {
    const student = students.find((item) => item.id === id);
    if (!student || student.balance + amount < 0) { notify("잔액이 부족해요."); return; }
    setStudents((items) => items.map((item) => item.id === id ? { ...item, balance: item.balance + amount } : item));
    setActivity((items) => [{ id: Date.now(), student: student.name, action: label, amount, time: "방금", kind: amount >= 0 ? "earn" : "spend" }, ...items]);
    notify(`${student.name}에게 ${amount >= 0 ? "별을 보냈어요" : "구매를 기록했어요"}.`);
  }
  function addStudent() {
    const name = newName.trim();
    if (!name) return;
    const avatars = ["🐻", "🐰", "🐧", "🦊", "🐸", "🐼"];
    setStudents((items) => [...items, { id: `s-${Date.now()}`, name, group: "새 모둠", balance: 500, avatar: avatars[items.length % avatars.length], color: "#e3efff", job: "미정" }]);
    setNewName(""); setShowAdd(false); notify(`${name} 학생을 추가했어요.`);
  }
  function buyProduct(product: Product) {
    const shopper = role === "student" ? students[0] : students[2];
    if (!shopper || shopper.balance < product.price || product.stock < 1) { notify("잔액 또는 재고를 확인해 주세요."); return; }
    updateBalance(shopper.id, -product.price, `${product.name} 구매`);
    setProducts((items) => items.map((item) => item.id === product.id ? { ...item, stock: item.stock - 1 } : item));
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setSection("home"); }}>
        <span className="brand-mark">S<span>✦</span></span><span className="brand-name">school<span>nation</span></span>
      </a>
      <div className="school-switch"><span className="school-avatar">햇</span><span><b>{className}</b><small>우리 반 공간</small></span><span className="chevron">⌄</span></div>
      <div className="nav-list">{navigation.map((item, index) => <div key={item.id}>
        {item.group && <p className="nav-caption">{item.group}</p>}
        <button className={`nav-item ${section === item.id ? "active" : ""}`} onClick={() => setSection(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === "queue" && <span className="nav-badge">2</span>}</button>
      </div>)}</div>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-spark">✳</span><b>반 운영이 처음인가요?</b><p>우리 반만의 약속과 경제를 차근차근 시작해 보세요.</p><button onClick={() => notify("도움말은 준비 중이에요.")}>도움말 보기 <span>↗</span></button></div><div className="teacher-profile"><span className="teacher-avatar">👩🏻‍🏫</span><span><b>담임 선생님</b><small>교사 계정</small></span><button aria-label="계정 메뉴" onClick={() => setRole(role === "teacher" ? "student" : "teacher")}>···</button></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><div className="breadcrumb">{className}<span>/</span><b>{navigation.find((item) => item.id === section)?.label}</b></div><div className="top-actions"><span className="today-date">2026년 11월 16일 월요일</span><button className="icon-button" aria-label="알림" onClick={() => notify("새 알림이 없어요.")}>♧<i /></button><button className="profile-chip" onClick={() => setRole(role === "teacher" ? "student" : "teacher")}><span>{role === "teacher" ? "👩🏻‍🏫" : "☀️"}</span>{role === "teacher" ? "선생님" : "햇살 학생"}<span className="chevron">⌄</span></button></div></header>
      <div className="page-content">
        <div className="demo-strip"><span className="demo-dot" /> 체험용 예시 데이터 <span>입력한 내용은 이 브라우저에만 저장됩니다.</span><button onClick={() => { localStorage.removeItem("schoolnation-demo-v1"); location.reload(); }}>처음 상태로</button></div>
        {section === "home" && <>
          <div className="welcome-row"><div><p className="eyebrow">MONDAY, NOVEMBER 16</p><h1>좋은 아침이에요, 선생님 <span>☀️</span></h1><p className="subheading">오늘도 아이들과 함께 우리 반을 채워봐요.</p></div><button className="primary-button" onClick={() => setShowAdd(true)}>＋ 학생 추가</button></div>
          <div className="hero-card"><div className="hero-copy"><span className="hero-kicker">이번 주 우리 반</span><h2>함께 쌓아가는<br />작은 약속들</h2><p>서로 돕고, 맡은 일을 해내며<br />우리 반의 하루를 만들어가요.</p><button onClick={() => setSection("students")}>우리 반 둘러보기 <span>→</span></button></div><div className="hero-art" aria-hidden="true"><div className="sun-disc">☀</div><div className="hill hill-back"/><div className="hill hill-front"/><div className="little-house">⌂</div><span className="float-star star-a">✦</span><span className="float-star star-b">✦</span><span className="float-cloud">☁</span></div></div>
          <div className="section-heading"><div><h2>우리 반 한눈에 보기</h2><p>오늘의 학급 경제 현황이에요.</p></div><button className="text-button" onClick={() => setSection("economy")}>자세히 보기 <span>→</span></button></div>
          <div className="stat-grid"><article className="stat-card"><span className="stat-icon mint">♧</span><span className="stat-label">함께하는 친구</span><strong>{students.length}<small>명</small></strong><span className="stat-note">우리 반 구성원</span></article><article className="stat-card"><span className="stat-icon peach">◉</span><span className="stat-label">우리 반 총 유통량</span><strong>{totalMoney.toLocaleString()}<small> {currency}</small></strong><span className="stat-note positive">이번 달 +12% <span>↗</span></span></article><article className="stat-card"><span className="stat-icon lilac">⌑</span><span className="stat-label">상점 상품</span><strong>{products.length}<small>개</small></strong><span className="stat-note">판매 중인 상품</span></article><article className="stat-card"><span className="stat-icon yellow">◷</span><span className="stat-label">예약 작업</span><strong>2<small>건</small></strong><span className="stat-note">오늘 오후 8시 반영</span></article></div>
          <div className="home-columns"><section className="panel students-panel"><div className="panel-heading"><div><h2>우리 반 친구들</h2><p>각자의 아바타와 잔액을 확인해요.</p></div><button className="round-arrow" onClick={() => setSection("students")}>→</button></div><div className="student-grid">{students.slice(0, 8).map((student) => <button className="student-tile" key={student.id} onClick={() => notify(`${student.name} · 잔액 ${student.balance.toLocaleString()} ${currency}`)}><span className="student-face" style={{ background: student.color }}>{student.avatar}</span><b>{student.name}</b><small>{student.group}</small><span className="tile-balance">✦ {student.balance.toLocaleString()}</span></button>)}</div><button className="subtle-button full-button" onClick={() => setSection("students")}>친구 모두 보기</button></section>
          <section className="panel activity-panel"><div className="panel-heading"><div><h2>최근 활동</h2><p>우리 반에서 일어난 일이에요.</p></div><button className="text-button" onClick={() => setSection("activity")}>모두 보기</button></div><ActivityList items={activity.slice(0, 4)} currency={currency}/><div className="mini-chart-title"><span>이번 주 거래 흐름</span><span className="chart-legend"><i/> 들어온 별</span></div><div className="mini-chart">{[36, 52, 43, 72, 57, 88, 66].map((height, index) => <div key={index} className="chart-column"><span style={{ height: `${height}%` }} /><small>{["월", "화", "수", "목", "금", "토", "일"][index]}</small></div>)}</div></section></div>
          <div className="bottom-note"><span>✳</span><div><b>오늘의 작은 약속</b><p>맡은 일을 끝내면 서로에게 고마움을 전해보세요.</p></div><button onClick={() => setSection("settings")}>학급 규칙 보기 →</button></div>
        </>}
        {section === "students" && <><PageTitle eyebrow="PEOPLE & TEAMS" title="학생과 모둠" description="우리 반 친구와 모둠을 관리해요." action={<button className="primary-button" onClick={() => setShowAdd(true)}>＋ 학생 추가</button>}/><div className="toolbar"><div className="filter-pills">{groups.map((group) => <button key={group} onClick={() => setGroupFilter(group)} className={groupFilter === group ? "selected" : ""}>{group}</button>)}</div><input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="학생 이름 검색"/></div><div className="student-admin-grid">{visibleStudents.map((student) => <article className="student-admin-card" key={student.id}><button className="more-button" onClick={() => updateBalance(student.id, 100, "도움 활동 보상")}>＋100</button><span className="student-face large" style={{ background: student.color }}>{student.avatar}</span><h3>{student.name}</h3><p>{student.group}</p><div className="student-meta"><span>맡은 일</span><b>{student.job}</b></div><div className="student-meta"><span>계좌 잔액</span><b>{student.balance.toLocaleString()} {currency}</b></div><button className="subtle-button full-button" onClick={() => notify(`${student.name}의 계정 설정은 연결 단계에서 제공할게요.`)}>학생 정보 보기</button></article>)}</div></>}
        {section === "economy" && <><PageTitle eyebrow="CLASS ECONOMY" title="계좌와 거래" description="잔액은 거래 원장으로 관리하고 모든 변동 이유를 남겨요."/><div className="stat-grid compact-stats"><Stat label="총 유통량" value={`${totalMoney.toLocaleString()} ${currency}`} icon="◉"/><Stat label="학생 평균 잔액" value={`${avgBalance.toLocaleString()} ${currency}`} icon="↗"/><Stat label="오늘 거래" value={`${activity.filter((item) => item.time === "방금" || item.time.includes("오전")).length}건`} icon="▤"/><Stat label="지급 대기" value="2건" icon="◷"/></div><section className="panel table-panel"><div className="panel-heading"><div><h2>계좌 목록</h2><p>교사는 보상 지급을 기록할 수 있어요.</p></div><button className="subtle-button" onClick={() => notify("거래 내보내기는 서버 연결 뒤 제공할게요.")}>내보내기 ↗</button></div><div className="table-wrap"><table><thead><tr><th>학생</th><th>모둠</th><th>맡은 일</th><th>현재 잔액</th><th>빠른 지급</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><span className="table-person"><span style={{ background: student.color }}>{student.avatar}</span><b>{student.name}</b></span></td><td>{student.group}</td><td>{student.job}</td><td><b>{student.balance.toLocaleString()} {currency}</b></td><td><button className="tiny-action" onClick={() => updateBalance(student.id, 100, "도움 활동 보상")}>＋100</button><button className="tiny-action" onClick={() => updateBalance(student.id, 300, "특별 활동 보상")}>＋300</button></td></tr>)}</tbody></table></div></section><section className="panel table-panel"><div className="panel-heading"><div><h2>최근 거래 원장</h2><p>사유가 있는 거래만 기록해요.</p></div></div><ActivityList items={activity} currency={currency}/></section></>}
        {section === "store" && <><PageTitle eyebrow="CLASS MARKET" title="학급 상점" description="아이들이 모은 별로 교실의 작은 혜택을 골라요." action={role === "teacher" ? <button className="primary-button" onClick={() => notify("상품 만들기는 다음 단계에서 연결해요.")}>＋ 상품 추가</button> : undefined}/><div className="store-callout"><span>🧺</span><div><b>필요한 만큼만, 함께 정한 가격으로</b><p>구매와 재고는 실제 운영에서는 서버에서 한 번에 확인하고 반영돼요.</p></div><button onClick={() => setSection("settings")}>상점 설정 →</button></div><div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><div className="product-art" style={{ background: product.color }}><span>{product.icon}</span><small>{product.category}</small></div><div className="product-copy"><div><h3>{product.name}</h3><p>남은 수량 {product.stock}개</p></div><strong>{product.price}<small> {currency}</small></strong></div><button className="subtle-button full-button" disabled={product.stock < 1} onClick={() => buyProduct(product)}>{product.stock ? "구매하기" : "품절"}</button></article>)}</div><div className="inventory-note">이 화면의 체험 구매는 이 브라우저의 예시 데이터만 바꿉니다. 실제 잔액·재고 차감은 연결된 데이터베이스의 원자적 거래 함수에서 처리하도록 준비하고 있어요.</div></>}
        {section === "activity" && <><PageTitle eyebrow="CLASS JOURNAL" title="활동 기록" description="거래와 운영 기록을 한곳에서 확인해요."/><div className="toolbar"><div className="filter-pills"><button className="selected">전체</button><button onClick={() => notify("기간 필터를 적용했어요.")}>오늘</button><button onClick={() => notify("기간 필터를 적용했어요.")}>이번 주</button></div><button className="subtle-button" onClick={() => notify("이 기록은 복구 가능한 보관함 방식으로 설계할 예정이에요.")}>선택 기록 관리</button></div><section className="panel table-panel"><ActivityList items={activity} currency={currency} detailed/></section></>}
        {section === "queue" && <><PageTitle eyebrow="DAILY PROCESSING" title="예약 작업" description="비용이 들지 않도록 요약과 예약 보상은 하루 한 번 처리해요." action={<button className="subtle-button" onClick={() => notify("체험 화면에서는 실제 작업을 실행하지 않아요.")}>개발용 작업 실행</button>}/><div className="queue-hero"><div className="queue-clock">◷</div><div><span className="queue-label">다음 처리 시각</span><h2>오늘 오후 8:00 <small>한국 시간</small></h2><p>실제 운영에서는 UTC 11:00에 데이터베이스 예약 작업이 대기 항목을 처리합니다.</p></div><span className="status-pill pending">대기 작업 2건</span></div><div className="queue-grid"><QueueCard icon="✦" title="직업 급여 지급" text="환경 지킴이 외 3명 · 오늘 20:00 예정" tag="급여"/><QueueCard icon="▥" title="주간 경제 요약" text="거래 합계와 학급 통계를 계산합니다." tag="요약"/></div><div className="inventory-note">예약 작업은 다시 실행해도 중복 반영되지 않도록 작업 ID와 처리 상태를 기록합니다. 실패한 작업은 재시도할 수 있고 처리 결과는 활동 기록에 남겨요.</div></>}
        {section === "settings" && <><PageTitle eyebrow="CLASS SETTINGS" title="학급 설정" description="학급의 이름과 화폐, 사용할 기능을 정해요."/><section className="panel settings-panel"><div className="setting-section"><h2>기본 정보</h2><p>아이들이 함께 부를 이름을 정해요.</p><div className="form-grid"><label>학급 이름<input value={className} onChange={(event) => setClassName(event.target.value)} /></label><label>학급 화폐 이름<input value={currency} onChange={(event) => setCurrency(event.target.value || "별")} /></label></div></div><div className="setting-section"><h2>학급 기능</h2><p>필요한 기능만 켜서 가볍게 시작해요.</p><div className="toggle-list">{[["economy", "학급 경제", "학급 계좌와 거래 기록"], ["jobs", "직업과 급여", "학생의 역할과 예약 보상"], ["transfer", "학생 간 송금", "학생이 서로 별을 보내기"], ["shop", "학급 상점", "상품 구매와 보유 아이템"], ["tax", "세금 관리", "구매세·급여 소득세"], ["investing", "재테크 활동", "예금 등 모의 자산 관리"], ["writing", "주제 글쓰기", "예정과 제출을 관리"], ["boards", "학급 게시판", "학급 소식과 공지"]].map(([key, label, description]) => <label className="toggle-row" key={key}><span><b>{label}</b><small>{description}</small></span><input type="checkbox" checked={Boolean(features[key as keyof typeof features])} onChange={() => setFeatures((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))}/><i/></label>)}</div></div><div className="setting-footer"><span>변경 사항은 이 체험 브라우저에 자동 저장돼요.</span><button className="primary-button" onClick={() => notify("학급 설정을 저장했어요.")}>저장 완료</button></div></section></>}
      </div>
    </section>
    {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><div className="modal-card" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowAdd(false)}>×</button><span className="modal-icon">♧</span><h2>새 친구를 초대해요</h2><p>체험 화면에서는 별명만 추가할 수 있어요.</p><label>학생 별명<input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addStudent()} placeholder="예: 무지개" /></label><div className="modal-actions"><button className="subtle-button" onClick={() => setShowAdd(false)}>취소</button><button className="primary-button" onClick={addStudent}>학생 추가</button></div></div></div>}
    {toast && <div className="toast">✓ <span>{toast}</span></div>}
  </main>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <div className="page-title-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subheading">{description}</p></div>{action}</div>; }
function Stat({ label, value, icon }: { label: string; value: string; icon: string }) { return <article className="stat-card"><span className="stat-icon mint">{icon}</span><span className="stat-label">{label}</span><strong className="stat-string">{value}</strong><span className="stat-note">기준: 오늘</span></article>; }
function QueueCard({ icon, title, text, tag }: { icon: string; title: string; text: string; tag: string }) { return <article className="queue-card"><span className="queue-card-icon">{icon}</span><div><b>{title}</b><p>{text}</p><span className="queue-tag">{tag}</span></div><span className="status-pill pending">대기 중</span></article>; }
function ActivityList({ items, currency, detailed = false }: { items: Activity[]; currency: string; detailed?: boolean }) { return <div className="activity-list">{items.map((item) => <div className="activity-row" key={item.id}><span className={`activity-icon ${item.kind}`}>{item.kind === "earn" ? "↗" : item.kind === "spend" ? "↙" : "✳"}</span><span className="activity-description"><b>{item.student}</b><small>{item.action}{detailed && <em> · {item.time}</em>}</small></span><span className={`activity-amount ${item.amount > 0 ? "positive" : item.amount < 0 ? "negative" : ""}`}>{item.amount ? `${item.amount > 0 ? "+" : ""}${item.amount.toLocaleString()} ${currency}` : "기록"}</span><small className="activity-time">{item.time}</small></div>)}</div>; }
