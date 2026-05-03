import { useMemo, useState, useEffect, useRef } from 'react';
import { fetchPackById, fetchPackSummaries } from './api/contentApi';
import { sampleMatterPack } from './data/sampleMatterPack';
import type { GameState, LifelineKey, Pack, Team } from './types/game';

type Screen = 'home' | 'pack-selection' | 'team-setup' | 'board' | 'question';
type PackSelectionStep = 'curriculum' | 'level' | 'subject' | 'pack';

const TEAM_COLORS = ['#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be123c', '#0f766e'];
const RECOMMENDED_PACK_ID = 'y5s-u3-matter';
const MAIN_TIMER_SECONDS = 60;
const OTHER_TEAM_TIMER_SECONDS = 15;
const MAIN_TIMER_WARNING_SECONDS = 10;

type GroupedPacks = { group: string; packs: Pack[] }[];

function normalizeText(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeCurriculum(pack: Pack): 'cambridge-primary' | 'american' | 'other' {
  const text = normalizeText(`${pack.displayGroup ?? ''} ${pack.stageLabel} ${pack.curriculumSystem ?? ''} ${pack.schoolTrack ?? ''}`);
  if (text.includes('cambridge') || text.includes('british') || text.includes('ig')) return 'cambridge-primary';
  if (text.includes('american') || text.includes('us')) return 'american';
  return 'other';
}

function normalizeLevel(pack: Pack): 'cambridge-stage-5' | 'american-grade-5' | 'other' {
  const curriculum = normalizeCurriculum(pack);
  const text = normalizeText(`${pack.stageLabel} ${pack.levelLabel ?? ''} ${pack.yearEquivalent ?? ''} ${pack.gradeEquivalent ?? ''} ${pack.title}`);
  if (curriculum === 'cambridge-primary' && (text.includes('stage 5') || text.includes('year 5'))) return 'cambridge-stage-5';
  if (curriculum === 'american' && (text.includes('grade 5') || text.includes('year 5'))) return 'american-grade-5';
  return 'other';
}

function normalizeSubject(pack: Pack): 'science' | 'math' | 'english' | 'other' {
  const text = normalizeText(`${pack.subjectLabel} ${pack.title}`);
  if (text.includes('science')) return 'science';
  if (text.includes('math')) return 'math';
  if (text.includes('english') || text.includes('ela') || text.includes('language arts')) return 'english';
  return 'other';
}

function getDisplaySubject(subject: string, curriculum: string | null): string {
  if (subject === 'science') return 'Science';
  if (subject === 'math') return curriculum === 'cambridge-primary' ? 'Maths' : 'Math';
  if (subject === 'english') return curriculum === 'cambridge-primary' ? 'English' : 'ELA';
  return 'Other';
}

function getUnitNumber(pack: Pack): number {
  const numericSort = Number((pack as Pack & { sortOrder?: number }).sortOrder);
  if (Number.isFinite(numericSort) && numericSort > 0) return numericSort;
  const fromTitle = pack.title.match(/\bunit\s*(\d+)\b/i);
  return fromTitle ? Number(fromTitle[1]) : Number.MAX_SAFE_INTEGER;
}

function sortAndGroupPacks(packs: Pack[]): GroupedPacks {
  const sorted = [...packs].sort((a, b) => {
    const aUnit = getUnitNumber(a);
    const bUnit = getUnitNumber(b);
    if (aUnit !== bUnit) return aUnit - bUnit;
    if (a.id === RECOMMENDED_PACK_ID) return -1;
    if (b.id === RECOMMENDED_PACK_ID) return 1;
    return a.title.localeCompare(b.title, undefined, { numeric: true });
  });

  return [{ group: 'Available Packs', packs: sorted }];
}

function createTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    points: 0,
    lifelinesUsed: { mcq: false, hint: false, twoAnswers: false },
  }));
}

function App() {
  const FEEDBACK_EMAIL = 'tasleyaonline@gmail.com';
  const [screen, setScreen] = useState<Screen>('home');
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [availablePacks, setAvailablePacks] = useState<Pack[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [packStartError, setPackStartError] = useState<string | null>(null);
  const [packSelectionStep, setPackSelectionStep] = useState<PackSelectionStep>('curriculum');
  const [selectedCurriculum, setSelectedCurriculum] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>(createTeams(2));
  const [state, setState] = useState<GameState | null>(null);
  const [mainTimer, setMainTimer] = useState(MAIN_TIMER_SECONDS);
  const [mainRunning, setMainRunning] = useState(false);
  const [otherTeamTimer, setOtherTeamTimer] = useState(OTHER_TEAM_TIMER_SECONDS);
  const [otherTeamRunning, setOtherTeamRunning] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showMcq, setShowMcq] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const warningAudioRef = useRef<HTMLAudioElement | null>(null);
  const warningSoundPlayingRef = useRef(false);

  function stopWarningSound(resetToStart = false) {
    const audio = warningAudioRef.current;
    if (!audio) return;
    audio.pause();
    if (resetToStart) audio.currentTime = 0;
    warningSoundPlayingRef.current = false;
  }

  function ensureWarningSoundPlaying() {
    const audio = warningAudioRef.current;
    if (!audio || warningSoundPlayingRef.current) return;
    audio.loop = true;
    audio.play()
      .then(() => {
        warningSoundPlayingRef.current = true;
      })
      .catch(() => {
        warningSoundPlayingRef.current = false;
      });
  }

  useEffect(() => {
    if (screen !== 'pack-selection') return;
    let active = true;
    setPacksLoading(true);
    setPacksError(null);
    fetchPackSummaries()
      .then((packs) => {
        if (!active) return;
        setAvailablePacks(packs);
        const recommended = packs.find((pack) => pack.id === RECOMMENDED_PACK_ID) ?? packs[0] ?? null;
        setSelectedPack(recommended);
      })
      .catch((error) => {
        if (!active) return;
        setPacksError(error instanceof Error ? error.message : 'Could not load packs from the content API.');
        setAvailablePacks([sampleMatterPack]);
        setSelectedPack(sampleMatterPack);
      })
      .finally(() => {
        if (active) setPacksLoading(false);
      });
    return () => {
      active = false;
    };
  }, [screen]);

  useEffect(() => {
    if (!mainRunning) return;
    const interval = setInterval(() => setMainTimer((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [mainRunning]);

  useEffect(() => {
    if (mainTimer !== 0) return;
    setMainRunning(false);
    if (state?.phase === 'question' && !state.stealPhase) {
      setState({ ...state, stealPhase: true });
      setOtherTeamTimer(OTHER_TEAM_TIMER_SECONDS);
      setOtherTeamRunning(true);
    }
  }, [mainTimer, state]);

  useEffect(() => {
    if (!otherTeamRunning) return;
    const interval = setInterval(() => setOtherTeamTimer((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [otherTeamRunning]);

  useEffect(() => {
    if (otherTeamTimer === 0) setOtherTeamRunning(false);
  }, [otherTeamTimer]);

  useEffect(() => {
    const isMainWarningWindow = screen === 'question' && state?.phase === 'question' && mainTimer > 0 && mainTimer <= MAIN_TIMER_WARNING_SECONDS;
    const isOtherTeamWarningWindow = screen === 'question' && state?.phase === 'question' && state.stealPhase && otherTeamTimer > 0;
    if (isMainWarningWindow || isOtherTeamWarningWindow) {
      ensureWarningSoundPlaying();
      return;
    }
    stopWarningSound();
  }, [screen, state, mainTimer, otherTeamTimer]);

  useEffect(() => {
    const audio = new Audio('/assets/sounds/timer-warning.mp3');
    audio.preload = 'auto';
    warningAudioRef.current = audio;
    return () => {
      stopWarningSound(true);
      warningAudioRef.current = null;
    };
  }, []);

  const currentTeam = useMemo(() => (!state ? null : state.teams[state.currentTeamTurnIndex] ?? null), [state]);
  const curriculumOptions = useMemo(() => {
    const keys = new Set(availablePacks.map((pack) => normalizeCurriculum(pack)).filter((key) => key !== 'other'));
    return [...keys].map((id) => ({
      id,
      label: id === 'cambridge-primary' ? 'British / IG / Cambridge Primary' : 'American',
      subtitle: id === 'cambridge-primary' ? 'Cambridge curriculum packs' : 'US curriculum packs',
    }));
  }, [availablePacks]);
  const levelOptions = useMemo(() => {
    if (!selectedCurriculum) return [];
    const levels = new Set(availablePacks.filter((pack) => normalizeCurriculum(pack) === selectedCurriculum).map((pack) => normalizeLevel(pack)).filter((level) => level !== 'other'));
    return [...levels].map((id) => ({ id, label: id === 'cambridge-stage-5' ? 'Cambridge Stage 5' : 'American Grade 5' }));
  }, [availablePacks, selectedCurriculum]);
  const subjectOptions = useMemo(() => {
    if (!selectedCurriculum || !selectedLevel) return [];
    const subjects = new Set(availablePacks
      .filter((pack) => normalizeCurriculum(pack) === selectedCurriculum && normalizeLevel(pack) === selectedLevel)
      .map((pack) => normalizeSubject(pack))
      .filter((subject) => subject !== 'other'));
    return [...subjects];
  }, [availablePacks, selectedCurriculum, selectedLevel]);
  const visiblePacks = useMemo(() => {
    if (!selectedCurriculum || !selectedLevel || !selectedSubject) return [];
    return availablePacks.filter((pack) => normalizeCurriculum(pack) === selectedCurriculum && normalizeLevel(pack) === selectedLevel && normalizeSubject(pack) === selectedSubject);
  }, [availablePacks, selectedCurriculum, selectedLevel, selectedSubject]);
  const groupedPacks = useMemo(() => sortAndGroupPacks(visiblePacks), [visiblePacks]);
  const currentQuestion = useMemo(() => {
    if (!state?.currentQuestionId || !state.pack) return null;
    for (const category of state.pack.categories) {
      const question = category.questions.find((item) => item.id === state.currentQuestionId);
      if (question) return { question, category };
    }
    return null;
  }, [state]);

  const totalQuestions = useMemo(() => (!state ? 0 : state.pack.categories.reduce((sum, category) => sum + category.questions.length, 0)), [state]);
  const remainingQuestions = useMemo(() => (!state ? 0 : totalQuestions - state.usedQuestionIds.length), [state, totalQuestions]);

  const canAnswerTeams = useMemo(() => {
    if (!state || !currentTeam) return [];
    return state.teams.filter((team) => team.id !== currentTeam.id);
  }, [state, currentTeam]);

  function buildMailtoLink(subject: string, body?: string) {
    const params = new URLSearchParams({ subject });
    if (body) params.set('body', body);
    return `mailto:${FEEDBACK_EMAIL}?${params.toString()}`;
  }

  const generalFeedbackLink = useMemo(
    () => buildMailtoLink('Feedback on Classroom Mode', 'Hi team,%0D%0A%0D%0ASharing classroom feedback:%0D%0A'),
    [],
  );
  const curriculumPackLink = useMemo(
    () => buildMailtoLink('Curriculum pack request', 'Hi team,%0D%0A%0D%0AI would like to request a curriculum pack for:%0D%0A'),
    [],
  );
  const questionIssueLink = useMemo(() => {
    const lines = ['Hi team,', '', 'I want to report a question issue.'];
    if (screen === 'question' && state && currentQuestion) {
      lines.push('', `Pack title: ${state.pack.title}`, `Category: ${currentQuestion.category.title}`, `Points: ${currentQuestion.question.points}`, `Question text: ${currentQuestion.question.prompt}`, `Answer: ${currentQuestion.question.answer}`);
    } else {
      lines.push('', '(No active question context included)');
    }
    return buildMailtoLink('Question issue report', lines.join('\n'));
  }, [screen, state, currentQuestion]);


  function resetGameSession() {
    stopWarningSound(true);
    setState(null);
    setTeams(createTeams(teamCount));
    setMainTimer(MAIN_TIMER_SECONDS);
    setMainRunning(false);
    setOtherTeamTimer(OTHER_TEAM_TIMER_SECONDS);
    setOtherTeamRunning(false);
    setShowAnswer(false);
    setShowMcq(false);
    setShowHint(false);
  }

  function returnToPackSelection() {
    if (screen === 'board') {
      const confirmed = window.confirm('Return to pack selection? Current scores and used questions will be lost.');
      if (!confirmed) return;
    }
    resetGameSession();
    setPackStartError(null);
    setScreen('pack-selection');
  }

  async function startGame() {
    if (!selectedPack) return;
    setPackStartError(null);
    setStartingGame(true);

    let fullPack: Pack | null = null;
    try {
      fullPack = await fetchPackById(selectedPack.id);
    } catch (error) {
      if (selectedPack.id === RECOMMENDED_PACK_ID) {
        fullPack = sampleMatterPack;
      } else {
        setPackStartError(error instanceof Error ? error.message : 'Could not load pack details.');
      }
    } finally {
      setStartingGame(false);
    }

    if (!fullPack) return;
    const hasQuestions = fullPack.categories.some((category) => category.questions.length > 0);
    if (!hasQuestions) {
      if (selectedPack.id === RECOMMENDED_PACK_ID) {
        fullPack = sampleMatterPack;
      } else {
        setPackStartError('Selected pack has no questions yet. Please choose another pack.');
        return;
      }
    }

    setState({ pack: fullPack, teams, currentTeamTurnIndex: 0, usedQuestionIds: [], currentQuestionId: null, phase: 'board', stealPhase: false });
    setScreen('board');
  }

  function openQuestion(id: string) {
    if (!state) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
    stopWarningSound(true);
    setState({ ...state, currentQuestionId: id, phase: 'question', stealPhase: false });
    setMainTimer(MAIN_TIMER_SECONDS);
    setMainRunning(true);
    setOtherTeamTimer(OTHER_TEAM_TIMER_SECONDS);
    setOtherTeamRunning(false);
    setShowAnswer(false);
    setShowMcq(false);
    setShowHint(false);
    setScreen('question');
  }

  function cancelQuestion() {
    if (!state) return;
    stopWarningSound(true);
    setState({ ...state, currentQuestionId: null, phase: 'board', stealPhase: false });
    setMainRunning(false);
    setOtherTeamRunning(false);
    setScreen('board');
  }

  function markLifelineUsed(kind: LifelineKey) {
    if (!state || !currentTeam) return;
    setState({
      ...state,
      teams: state.teams.map((team) =>
        team.id === currentTeam.id ? { ...team, lifelinesUsed: { ...team.lifelinesUsed, [kind]: true } } : team,
      ),
    });
  }

  function advanceTurn(nextState: GameState) {
    stopWarningSound(true);
    const nextIndex = (nextState.currentTeamTurnIndex + 1) % nextState.teams.length;
    setState({ ...nextState, currentTeamTurnIndex: nextIndex, currentQuestionId: null, phase: 'board', stealPhase: false });
    setMainRunning(false);
    setOtherTeamRunning(false);
    setScreen('board');
  }

  function consumeQuestion(updatedTeams = state?.teams ?? []) {
    if (!state || !currentQuestion) return;
    const nextState: GameState = {
      ...state,
      teams: updatedTeams,
      usedQuestionIds: [...state.usedQuestionIds, currentQuestion.question.id],
    };
    advanceTurn(nextState);
  }

  function handleCorrect() {
    if (!state || !currentQuestion || !currentTeam) return;
    const updatedTeams = state.teams.map((team) =>
      team.id === currentTeam.id ? { ...team, points: team.points + currentQuestion.question.points } : team,
    );
    consumeQuestion(updatedTeams);
  }

  function handleIncorrect() {
    if (!state) return;
    if (!state.stealPhase) {
      setState({ ...state, stealPhase: true });
      setMainRunning(false);
      setOtherTeamTimer(OTHER_TEAM_TIMER_SECONDS);
      setOtherTeamRunning(true);
      return;
    }
    stopWarningSound(true);
    consumeQuestion(state.teams);
  }

  function handleAnsweredByTeam(teamId: string) {
    if (!state || !currentQuestion) return;
    const updatedTeams = state.teams.map((team) =>
      team.id === teamId ? { ...team, points: team.points + currentQuestion.question.points } : team,
    );
    consumeQuestion(updatedTeams);
  }

  const mainTimerUrgent = mainTimer <= 10;
  const revealReady = mainTimer === 0;
  const otherTeamLabel = state && canAnswerTeams.length === 1
    ? `Chance for ${canAnswerTeams[0].name} to answer`
    : 'Chance for other team(s) to answer';

  return <div className="app-shell"><header className="app-header"><h1>Clash of Classes • Classroom Mode</h1><button className="secondary-btn feedback-open-btn" onClick={() => setShowFeedbackPanel(true)}>Send Feedback</button></header>
      {showFeedbackPanel && <div className="feedback-modal-backdrop" role="presentation" onClick={() => setShowFeedbackPanel(false)}>
          <section className="feedback-modal panel" role="dialog" aria-modal="true" aria-label="Send feedback" onClick={(event) => event.stopPropagation()}>
            <div className="feedback-modal-header">
              <h2>Send Feedback</h2>
              <button className="secondary-btn" onClick={() => setShowFeedbackPanel(false)}>Close</button>
            </div>
            <p className="feedback-modal-support">Choose an option below to open your email app with a pre-filled subject and helpful details.</p>
            <div className="feedback-options">
              <a className="feedback-link-card" href={generalFeedbackLink}>General feedback</a>
              <a className="feedback-link-card" href={questionIssueLink}>Report a question issue</a>
              <a className="feedback-link-card" href={curriculumPackLink}>Request a curriculum pack</a>
            </div>
            <section className="teacher-testing-checklist" aria-label="Teacher testing checklist">
              <h3>Teacher Testing Checklist (MVP)</h3>
              <p className="teacher-testing-support">Use this quick flow in a live classroom test and then share feedback.</p>
              <ol>
                <li>Choose a curriculum pack.</li>
                <li>Set 2–4 teams.</li>
                <li>Open 2–3 questions.</li>
                <li>Try <strong>Hint</strong>, <strong>MCQ</strong>, and <strong>Give two answers</strong>.</li>
                <li>Try <strong>Correct</strong>, <strong>Incorrect</strong>, and <strong>Answered by Team X</strong>.</li>
                <li>Try <strong>Report this question</strong>.</li>
              </ol>
              <h4>Suggested feedback prompts</h4>
              <ul>
                <li>Was the flow easy to understand?</li>
                <li>Was the question readable on a smartboard?</li>
                <li>Was the timer/audio helpful or annoying?</li>
                <li>Were the questions suitable for Year 5 / Grade 5?</li>
                <li>What pack would you want next?</li>
              </ul>
            </section>
          </section>
        </div>}
      {screen === 'home' && <section className="panel home-panel">
          <div className="home-hero">
            <p className="home-kicker">Classroom Game Host</p>
            <h2>Turn Review Time into a Team Challenge</h2>
            <p className="home-support">Launch in under a minute: pick a curriculum pack, set team names, and run an energetic whole-class quiz battle from your board.</p>
            <ul className="home-benefits" aria-label="Key classroom benefits">
              <li>Fast setup with curriculum-aligned packs</li>
              <li>Built for live hosting with clear score tracking</li>
              <li>Great for lesson warm-ups, review, and exit tickets</li>
            </ul>
            <div className="home-cta-row"><button className="home-primary-cta" onClick={() => { setSelectedCurriculum(null); setSelectedLevel(null); setSelectedSubject(null); setPackSelectionStep('curriculum'); setScreen('pack-selection'); }}>Start Classroom Mode</button></div>
          </div>
        </section>}
      {screen === 'pack-selection' && <section className="panel pack-selection-panel">
          <div className="pack-selection-header">
            <p className="pack-selection-kicker">Classroom Setup</p>
            <h2>{packSelectionStep === 'curriculum' ? 'Choose Curriculum' : packSelectionStep === 'level' ? 'Choose Year / Level' : packSelectionStep === 'subject' ? 'Choose a Subject' : 'Choose a Pack'}</h2>
            <p className="pack-selection-support">{packSelectionStep === 'curriculum' ? 'Start by choosing your curriculum.' : packSelectionStep === 'level' ? 'Choose the year/level for your curriculum.' : packSelectionStep === 'subject' ? 'Select a subject to narrow to relevant classroom packs.' : 'Choose a curriculum pack to launch Team Setup.'}</p>
          </div>
          {packsLoading && <div className="status-box status-loading"><p className="status-title">Preparing classroom packs…</p><p>Loading available packs from the content service.</p></div>}
          {packsError && <div className="status-box status-warning"><p className="status-title">API unavailable</p><p>{packsError}</p><p>Using local classroom fallback pack.</p></div>}
          {!packsLoading && packSelectionStep === 'curriculum' && <div className="selection-grid">
              {curriculumOptions.map((curriculum) => <button key={curriculum.id} className="pack-card" onClick={() => { setSelectedCurriculum(curriculum.id); setSelectedLevel(null); setSelectedSubject(null); setPackSelectionStep('level'); }}>
                  <div className="pack-card-top"><strong className="pack-title">{curriculum.label}</strong></div>
                  <span className="pack-card-meta">{curriculum.subtitle}</span>
                </button>)}
            </div>}
          {!packsLoading && packSelectionStep === 'level' && <div className="selection-grid">
              {levelOptions.map((level) => <button key={level.id} className="pack-card" onClick={() => { setSelectedLevel(level.id); setSelectedSubject(null); setPackSelectionStep('subject'); }}>
                  <div className="pack-card-top"><strong className="pack-title">{level.label}</strong></div>
                  <span className="pack-card-meta">{selectedCurriculum === 'cambridge-primary' ? 'British / IG / Cambridge Primary' : 'American'}</span>
                </button>)}
            </div>}
          {!packsLoading && packSelectionStep === 'subject' && <>
              <div className="selection-grid">
                {subjectOptions.map((subject) => <button key={subject} className="pack-card" onClick={() => { setSelectedSubject(subject); setPackSelectionStep('pack'); }}>
                    <div className="pack-card-top"><strong className="pack-title">{getDisplaySubject(subject, selectedCurriculum)}</strong></div>
                    <span className="pack-card-meta">{levelOptions.find((level) => level.id === selectedLevel)?.label ?? 'Matching packs'}</span>
                  </button>)}
              </div>
            </>}
          {!packsLoading && packSelectionStep === 'pack' && groupedPacks.map((group) => <div key={group.group} className="pack-group">
              <h3 className="pack-group-heading">{group.group}</h3>
              <div className="pack-grid">
                {group.packs.map((pack) => {
                  const recommended = pack.id === RECOMMENDED_PACK_ID;
                  const selected = selectedPack?.id === pack.id;
                  return <button key={pack.id} className={`pack-card ${selected ? 'pack-card-selected' : ''}`} onClick={() => { setSelectedPack(pack); setScreen('team-setup'); }}>
                    <div className="pack-card-top">
                      <strong className="pack-title">{pack.title}</strong>
                      {recommended && <span className="recommended-badge">Recommended</span>}
                    </div>
                    <span className="pack-card-meta">{pack.stageLabel}</span>
                    <span className="pack-card-meta">{getDisplaySubject(normalizeSubject(pack), selectedCurriculum)}</span>
                  </button>;
                })}
              </div>
            </div>)}
        <div className="actions">
          {packSelectionStep === 'level' && <button className="secondary-btn" onClick={() => { setSelectedCurriculum(null); setPackSelectionStep('curriculum'); }}>Back to Curriculum</button>}
          {packSelectionStep === 'subject' && <button className="secondary-btn" onClick={() => { setSelectedSubject(null); setPackSelectionStep('level'); }}>Back to Year / Level</button>}
          {packSelectionStep === 'pack' && <button className="secondary-btn" onClick={() => { setSelectedPack(null); setPackSelectionStep('subject'); }}>Back to Subject</button>}
          <button className="secondary-btn" onClick={() => setScreen('home')}>Back to Main Menu</button>
        </div></section>}
      {screen === 'team-setup' && <section className="panel team-setup-panel">
          <div className="team-setup-header">
            <p className="pack-selection-kicker">Classroom Setup</p>
            <h2>Team Setup</h2>
            {selectedPack && <p className="team-setup-pack">Selected pack: <strong>{selectedPack.title}</strong></p>}
          </div>
          {packStartError && <p className="status-box status-warning team-setup-error"><strong>Could not start game:</strong> {packStartError}</p>}
          <label className="team-count-field">Number of teams
            <select value={teamCount} onChange={(e) => { const count = Number(e.target.value); setTeamCount(count); const nextTeams = createTeams(count); setTeams((prev) => nextTeams.map((team, i) => ({ ...team, name: prev[i]?.name ?? team.name }))); }}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="teams-grid">{teams.map((team, i) => <input key={team.id} aria-label={`Team ${i + 1} name`} value={team.name} onChange={(e) => setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, name: e.target.value } : t))} style={{ borderColor: TEAM_COLORS[i] }} />)}</div>
          <div className="actions setup-actions"><button disabled={startingGame} onClick={startGame}>{startingGame ? 'Loading Pack...' : 'Start Game'}</button><button className="secondary-btn" onClick={returnToPackSelection}>Back to Pack Selection</button></div></section>}
      {screen === 'board' && state && (
        <section className="panel board-panel">
          <div className="board-header">
            <div className="board-title-block">
              <p className="board-title-kicker">Classroom Battle Board</p>
              <h2 className="board-pack-title">{state.pack.title}</h2>
            </div>
            <button className="danger-secondary-btn" onClick={returnToPackSelection}>Return to Pack Selection</button>
          </div>
          <div className="board-status-row">
            <p className="turn-pill">Current turn: <strong>{state.teams[state.currentTeamTurnIndex].name}</strong></p>
            <p className="board-meta">Remaining questions: <strong>{remainingQuestions}</strong> / {totalQuestions}</p>
          </div>
          <p className="rules-note"><strong>Play format:</strong> Pick one card → read question → mark outcome. Incorrect answers open a 15s other-team chance phase.</p>
          <div className="score-row">
            {state.teams.map((team, idx) => (
              <div key={team.id} className={`score-card ${idx === state.currentTeamTurnIndex ? 'score-card-active' : ''}`}>
                <p className="score-label">Team</p>
                <h3>{team.name}</h3>
                <p className="score-value">{team.points}</p>
              </div>
            ))}
          </div>
          <div className="board">
            {state.pack.categories.map((cat) => (
              <div key={cat.id} className="cat-col">
                <h3>{cat.title}</h3>
                {cat.questions.map((q) => {
                  const used = state.usedQuestionIds.includes(q.id);
                  return (
                    <button key={q.id} disabled={used} className={`card ${used ? 'card-used' : ''}`} onClick={() => openQuestion(q.id)}>
                      {used ? 'Used' : q.points}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}
      {screen === 'question' && state && currentQuestion && currentTeam && <section className="panel question-screen">
          <div className="question-screen-header">
            <p className="turn-pill question-team-pill">Current team: <strong>{currentTeam.name}</strong></p>
            <div className="question-meta-row">
              <p className="question-support-label">Question</p>
              <h2 className="question-title">{currentQuestion.category.title} • {currentQuestion.question.points} pts</h2>
            </div>
          </div>

          <article className="question-prompt-card" aria-label="Question prompt">
            <p className="question-prompt-text">{currentQuestion.question.prompt}</p>
          </article>

          <div className="question-controls-grid">
            <div className={`timer-row timer-box question-control-panel premium-timer ${mainRunning ? 'timer-running' : ''} ${mainTimerUrgent ? 'timer-urgent' : ''}`}><strong>Question Timer: {mainTimer}s</strong><button onClick={() => setMainRunning((v) => !v)}>{mainRunning ? 'Pause' : 'Resume'}</button><button onClick={() => { setMainTimer(MAIN_TIMER_SECONDS); setMainRunning(true); }}>Reset</button></div>

            <div className={`reveal-panel question-control-panel ${revealReady ? 'reveal-ready' : ''}`}>
              <p className="panel-title"><strong>Answer reveal</strong></p>
              <button onClick={() => setShowAnswer(true)} className={revealReady ? 'highlight-button' : ''}>Show Answer</button>
              {showAnswer && <div className="revealed-answer-block" role="status" aria-live="polite" aria-label="Revealed answer"><p className="revealed-answer-label">Answer</p><p className="revealed-answer-text">{currentQuestion.question.answer}</p></div>}
            </div>

            <div className="lifeline-panel question-control-panel"><p className="panel-title"><strong>Lifelines ({currentTeam.name})</strong></p><div className="actions compact-actions"><button className="lifeline-btn" disabled={currentTeam.lifelinesUsed.mcq} onClick={() => { markLifelineUsed('mcq'); setShowMcq(true); }}>{currentTeam.lifelinesUsed.mcq ? 'MCQ options used' : 'MCQ options'}</button><button className="lifeline-btn" disabled={currentTeam.lifelinesUsed.hint} onClick={() => { markLifelineUsed('hint'); setShowHint(true); }}>{currentTeam.lifelinesUsed.hint ? 'Hint used' : 'Hint'}</button><button className="lifeline-btn" disabled={currentTeam.lifelinesUsed.twoAnswers} onClick={() => markLifelineUsed('twoAnswers')}>{currentTeam.lifelinesUsed.twoAnswers ? 'Give two answers used' : 'Give two answers'}</button></div></div>
          </div>

          {showMcq && currentQuestion.question.mcqOptions && <ul className="question-detail-list">{currentQuestion.question.mcqOptions.map((o) => <li key={o}>{o}</li>)}</ul>}
          {showHint && <p className="question-detail-hint"><em>Hint: {currentQuestion.question.hint}</em></p>}

          {state.stealPhase && <div className="steal-box"><p><strong>{otherTeamLabel}</strong></p><p className="other-team-timer">Timer: {otherTeamTimer}s</p><p>Teams that can answer: {canAnswerTeams.map((team) => team.name).join(', ')}</p></div>}

          <hr className="question-divider" /><div className="actions outcome-actions"><button className="outcome-correct" onClick={handleCorrect}>✅ Correct</button><button className="outcome-incorrect" onClick={handleIncorrect}>❌ Incorrect</button>{canAnswerTeams.map((team) => <button key={team.id} className="outcome-neutral" onClick={() => handleAnsweredByTeam(team.id)}>Answered by {team.name}</button>)}<a className="report-issue-inline" href={questionIssueLink}>Report this question</a><button className="cancel-btn outcome-back" onClick={cancelQuestion}>Back to Board (Cancel Question)</button></div></section>}
    </div>;
}

export default App;
