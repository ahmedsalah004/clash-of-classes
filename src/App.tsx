const features = [
  {
    title: 'Teacher dashboard',
    description: 'Track classes, game sessions, and performance data in one place.',
  },
  {
    title: 'Create a game',
    description: 'Build quick quiz battles and revision activities for any subject.',
  },
  {
    title: 'Join with room code',
    description: 'Students join in seconds using a simple room code from any device.',
  },
  {
    title: 'Live classroom screen',
    description: 'Display live scores, prompts, and team progress during sessions.',
  },
];

function App() {
  return (
    <div className="page">
      <header className="site-header">
        <p className="brand">Clash of Classes</p>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Classroom Quiz Platform</p>
          <h1>Run live classroom quiz battles and revision games with confidence.</h1>
          <p>
            Clash of Classes helps teachers create engaging, structured competitions that make
            revision active, collaborative, and fun for students.
          </p>
          <div className="hero-actions">
            <button type="button">Start scaffolding</button>
            <button type="button" className="secondary">
              Explore features
            </button>
          </div>
        </section>

        <section className="feature-grid" aria-label="MVP sections">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card">
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
              <span className="tag">Placeholder</span>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;
