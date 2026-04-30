import { useMemo, useState, useEffect } from 'react';
import { sampleMatterPack } from './data/sampleMatterPack';
import type { GameState, LifelineKey, Pack, Team } from './types/game';

type Screen = 'home' | 'pack-selection' | 'team-setup' | 'board' | 'question';
type Outcome = 'correct' | 'wrong' | 'stolen' | 'none';

const TEAM_COLORS = ['#1d4ed8', '#047857', '#b45309', '#7c3aed', '#be123c', '#0f766e'];

function createTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    points: 0,
    lifelinesUsed: {
      mcq: false,
      hint: false,
      twoAnswers: false,
    },
  }));
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>(createTeams(2));
  const [state, setState] = useState<GameState | null>(null);
  const [mainTimer, setMainTimer] = useState(60);
  const [mainRunning, setMainRunning] = useState(false);
  const [stealTimer, setStealTimer] = useState(10);
  const [stealRunning, setStealRunning] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showMcq, setShowMcq] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!mainRunning) return;
    const interval = setInterval(() => setMainTimer((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [mainRunning]);

  useEffect(() => {
    if (mainTimer === 0) setMainRunning(false);
  }, [mainTimer]);

  useEffect(() => {
    if (!stealRunning) return;
    const interval = setInterval(() => setStealTimer((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [stealRunning]);

  useEffect(() => {
    if (stealTimer === 0) setStealRunning(false);
  }, [stealTimer]);

  const currentTeam = useMemo(() => {
    if (!state) return null;
    return state.teams[state.currentTeamTurnIndex] ?? null;
  }, [state]);

  const currentQuestion = useMemo(() => {
    if (!state?.currentQuestionId || !state.pack) return null;
    for (const category of state.pack.categories) {
      const question = category.questions.find((item) => item.id === state.currentQuestionId);
      if (question) return { question, category };
    }
    return null;
  }, [state]);

  const totalQuestions = useMemo(() => {
    if (!state) return 0;
    return state.pack.categories.reduce((sum, category) => sum + category.questions.length, 0);
  }, [state]);

  const remainingQuestions = useMemo(() => {
    if (!state) return 0;
    return totalQuestions - state.usedQuestionIds.length;
  }, [state, totalQuestions]);

  function startGame() {
    if (!selectedPack) return;
    setState({
      pack: selectedPack,
      teams,
      currentTeamTurnIndex: 0,
      usedQuestionIds: [],
      currentQuestionId: null,
      phase: 'board',
      stealPhase: false,
    });
    setScreen('board');
  }

  function openQuestion(id: string) {
    if (!state) return;
    setState({ ...state, currentQuestionId: id, phase: 'question', stealPhase: false });
    setMainTimer(60);
    setMainRunning(false);
    setStealTimer(10);
    setStealRunning(false);
    setShowAnswer(false);
    setShowMcq(false);
    setShowHint(false);
    setScreen('question');
  }

  function cancelQuestion() {
    if (!state) return;
    setState({ ...state, currentQuestionId: null, phase: 'board', stealPhase: false });
    setMainRunning(false);
    setStealRunning(false);
    setScreen('board');
  }

  function markLifelineUsed(kind: LifelineKey) {
    if (!state || !currentTeam) return;
    setState({
      ...state,
      teams: state.teams.map((team) =>
        team.id === currentTeam.id
          ? { ...team, lifelinesUsed: { ...team.lifelinesUsed, [kind]: true } }
          : team,
      ),
    });
  }

  function advanceTurn(nextState: GameState) {
    const nextIndex = (nextState.currentTeamTurnIndex + 1) % nextState.teams.length;
    setState({
      ...nextState,
      currentTeamTurnIndex: nextIndex,
      currentQuestionId: null,
      phase: 'board',
      stealPhase: false,
    });
    setMainRunning(false);
    setStealRunning(false);
    setScreen('board');
  }

  function applyOutcome(outcome: Outcome, stolenTeamId?: string) {
    if (!state || !currentQuestion) return;
    let updatedTeams = state.teams;

    if (outcome === 'correct' && currentTeam) {
      updatedTeams = state.teams.map((team) =>
        team.id === currentTeam.id ? { ...team, points: team.points + currentQuestion.question.points } : team,
      );
    }

    if (outcome === 'stolen' && stolenTeamId) {
      updatedTeams = state.teams.map((team) =>
        team.id === stolenTeamId ? { ...team, points: team.points + currentQuestion.question.points } : team,
      );
    }

    const nextState: GameState = {
      ...state,
      teams: updatedTeams,
      usedQuestionIds: [...state.usedQuestionIds, currentQuestion.question.id],
    };
    advanceTurn(nextState);
  }

  return (
    <div className="app-shell">
      <header><h1>Clash of Classes • Classroom Mode Prototype</h1></header>
      {screen === 'home' && <section className="panel"><h2>Teacher-led Smartboard Play</h2><button onClick={() => setScreen('pack-selection')}>Start Classroom Mode</button></section>}
      {screen === 'pack-selection' && (
        <section className="panel">
          <h2>Select Pack</h2>
          <button className="pack-card" onClick={() => { setSelectedPack(sampleMatterPack); setScreen('team-setup'); }}>
            <strong>{sampleMatterPack.title}</strong>
            <span>Cambridge Stage 5 / Year 5 Science</span>
          </button>
        </section>
      )}
      {screen === 'team-setup' && (
        <section className="panel">
          <h2>Team Setup</h2>
          <label>Number of teams
            <select value={teamCount} onChange={(e) => {
              const count = Number(e.target.value);
              setTeamCount(count);
              const nextTeams = createTeams(count);
              setTeams((prev) => nextTeams.map((team, i) => ({ ...team, name: prev[i]?.name ?? team.name })));
            }}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="teams-grid">{teams.map((team, i) => <input key={team.id} value={team.name} onChange={(e) => setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, name: e.target.value } : t))} style={{ borderColor: TEAM_COLORS[i] }} />)}</div>
          <button onClick={startGame}>Start Game</button>
        </section>
      )}
      {screen === 'board' && state && (
        <section className="panel">
          <h2>{state.pack.title}</h2>
          <p className="turn-pill">Current turn: <strong>{state.teams[state.currentTeamTurnIndex].name}</strong></p>
          <p className="board-meta">Remaining questions: <strong>{remainingQuestions}</strong> / {totalQuestions}</p>
          <p className="rules-note"><strong>Play format:</strong> Pick one card → read question → mark outcome. Wrong answers enter a 10s steal phase for other teams.</p>
          <div className="score-row">{state.teams.map((team, idx) => <div key={team.id} className={`score-card ${idx === state.currentTeamTurnIndex ? 'score-card-active' : ''}`}><h3>{team.name}</h3><p>{team.points}</p></div>)}</div>
          <div className="board">{state.pack.categories.map((cat) => <div key={cat.id} className="cat-col"><h3>{cat.title}</h3>{cat.questions.map((q) => {
            const used = state.usedQuestionIds.includes(q.id);
            return <button key={q.id} disabled={used} className={`card ${used ? 'card-used' : ''}`} onClick={() => openQuestion(q.id)}>{used ? 'Used' : q.points}</button>;
          })}</div>)}</div>
        </section>
      )}
      {screen === 'question' && state && currentQuestion && currentTeam && (
        <section className="panel">
          <div className="question-header">
            <p className="turn-pill">Current team: <strong>{currentTeam.name}</strong></p>
            <h2>{currentQuestion.category.title} • {currentQuestion.question.points} pts</h2>
          </div>
          <p>{currentQuestion.question.prompt}</p>
          <div className={`timer-row timer-box ${mainRunning ? 'timer-running' : ''}`}><strong>Question Timer: {mainTimer}s</strong><button onClick={() => setMainRunning((v) => !v)}>{mainRunning ? 'Pause' : 'Start'}</button><button onClick={() => { setMainTimer(60); setMainRunning(false); }}>Reset</button></div>
          <div className="lifeline-panel">
            <p><strong>Lifelines ({currentTeam.name})</strong></p>
            <div className="actions"><button onClick={() => setShowAnswer(true)}>Show Answer</button><button disabled={currentTeam.lifelinesUsed.mcq} onClick={() => { markLifelineUsed('mcq'); setShowMcq(true); }}>{currentTeam.lifelinesUsed.mcq ? 'MCQ Used' : 'Show MCQ options'}</button><button disabled={currentTeam.lifelinesUsed.hint} onClick={() => { markLifelineUsed('hint'); setShowHint(true); }}>{currentTeam.lifelinesUsed.hint ? 'Hint Used' : 'Show Hint'}</button><button disabled={currentTeam.lifelinesUsed.twoAnswers} onClick={() => markLifelineUsed('twoAnswers')}>{currentTeam.lifelinesUsed.twoAnswers ? 'Two Answers Used' : 'Mark Two Answers used'}</button></div>
          </div>
          {showMcq && currentQuestion.question.mcqOptions && <ul>{currentQuestion.question.mcqOptions.map((o) => <li key={o}>{o}</li>)}</ul>}
          {showHint && <p><em>Hint: {currentQuestion.question.hint}</em></p>}
          {showAnswer && <p><strong>Answer:</strong> {currentQuestion.question.answer}</p>}
          <hr />
          <div className="actions outcome-actions"><button onClick={() => applyOutcome('correct')}>✅ Correct</button><button onClick={() => { setState({ ...state, stealPhase: true }); setMainRunning(false); setStealTimer(10); setStealRunning(true); }}>❌ Wrong → Steal Phase</button><button onClick={() => applyOutcome('none')}>⏭️ No one correct</button><button className="cancel-btn" onClick={cancelQuestion}>Back to Board (Cancel Question)</button></div>
          {state.stealPhase && <div className="steal-box"><p><strong>Steal phase active</strong> • Timer: {stealTimer}s</p><div className="actions">{state.teams.filter((t) => t.id !== currentTeam.id).map((t) => <button key={t.id} onClick={() => applyOutcome('stolen', t.id)}>Stolen by {t.name}</button>)}</div></div>}
        </section>
      )}
    </div>
  );
}

export default App;
