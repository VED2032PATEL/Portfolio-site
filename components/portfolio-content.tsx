export const CHAPTERS = ['About', 'Projects', 'My story', 'Contact'] as const;

const projects = [
  {
    name: 'StudyFlow',
    label: 'Student guidance · Full stack',
    url: 'https://github.com/VED2032PATEL/StudyFlow-Polished',
    description:
      'Study plans shaped around available hours, topic difficulty, and deadlines. Built as my college minor project.',
    detail:
      'AI-assisted guidance, practice questions, spaced revision, progress analytics, and social learning.',
    stack: 'Python · Flask · JavaScript · SQLite · Groq',
  },
  {
    name: 'U2.7 / ULTRON',
    label: 'Desktop automation · AI assistant',
    url: 'https://github.com/VED2032PATEL/U2.7',
    description:
      'A local-first desktop assistant with voice conversations, task planning, and a reactive 3D interface.',
    detail:
      'Personalized memory and tool execution for app control, research, and file workflows, with validation, safeguards, and pause/resume controls.',
    stack: 'Python · JavaScript · Three.js · pywebview · Deepgram',
  },
  {
    name: 'MemoryForge',
    label: 'Machine learning · Team BitWise',
    url: 'https://github.com/VED2032PATEL/MemoryForge',
    description:
      'An associative-memory lab built with Team BitWise for DataForge 2026. New associations, frozen encoder weights.',
    detail:
      'Evaluated across 50 seeds and 650 conditions. Mean held-out digit query accuracy: 98.07% with ten clean demonstrations per class; zero encoder parameter change.',
    stack: 'PyTorch · Streamlit · NumPy · scikit-learn · Plotly',
  },
];

export function PortfolioContent({ index }: { index: number }) {
  return (
    <div className="chapter-layout">
      <section className="chapter-left">
        <p className="eyebrow">
          {
            [
              'Ved Patel · Developer',
              'Selected projects',
              'Learning through building',
              'Let’s connect',
            ][index]
          }
        </p>
        <h1>
          {index === 0 && (
            <>
              Curious.
              <br />
              <span className="serif-word">By design.</span>
              <br />
              Builder.
              <br />
              By doing.
            </>
          )}
          {index === 1 && (
            <>
              Ideas into
              <br />
              <span className="serif-word">working</span>
              <br />
              software.
            </>
          )}
          {index === 2 && (
            <>
              Build.
              <br />
              <span className="serif-word">Question.</span>
              <br />
              Repeat.
            </>
          )}
          {index === 3 && (
            <>
              Let’s build
              <br />
              <span className="serif-word">something</span>
              <br />
              useful.
            </>
          )}
        </h1>
        <p className="chapter-intro">
          {
            [
              'I’m Ved, a Computer Science student building AI assistants, full-stack applications, and machine learning experiments with Python and JavaScript.',
              'From helping students plan their learning to making desktop workflows conversational, I turn practical problems into software I can test and improve.',
              'My work connects three questions: how can software help us learn, make everyday tasks easier, and make AI behavior easier to understand?',
              'Have a project, an internship opportunity, or an experiment worth exploring? I’d love to hear about it.',
            ][index]
          }
        </p>
        <p className="chapter-hint">
          Scroll to explore. Click the spider emblem for the next chapter.
        </p>
      </section>
      <section className="chapter-right" aria-label={CHAPTERS[index]}>
        <span className="chapter-number">
          0{index + 1}
          <span> / 0{CHAPTERS.length}</span>
        </span>
        {index === 0 && (
          <>
            <p className="eyebrow">Practical problems. Playful interfaces.</p>
            <h2>
              AI with a<br />
              <em>useful purpose.</em>
            </h2>
            <p>
              I build across the interface and the logic behind it: study
              guidance, desktop automation, and reproducible ML experiments.
            </p>
            <div className="detail-list">
              <p>
                <span>BUILD</span>Python, JavaScript, Flask, SQL
              </p>
              <p>
                <span>EXPLORE</span>PyTorch, scikit-learn, NumPy
              </p>
              <p>
                <span>CONNECT</span>APIs, voice, Three.js interfaces
              </p>
            </div>
            <p className="education-note">
              B.Tech · Computer Science & Engineering
              <br />
              Shri Ram Institute of Technology
              <br />
              Jabalpur, Madhya Pradesh
            </p>
          </>
        )}
        {index === 1 && (
          <>
            <p className="eyebrow">Built, tested, and still evolving</p>
            {projects.map((project) => (
              <article className="project-item" key={project.name}>
                <span>{project.label}</span>
                <h2>
                  <a href={project.url} target="_blank" rel="noreferrer">
                    {project.name}
                  </a>
                </h2>
                <p>{project.description}</p>
                <details>
                  <summary>Inside the project</summary>
                  <p>{project.detail}</p>
                  <p className="project-stack">{project.stack}</p>
                </details>
              </article>
            ))}
          </>
        )}
        {index === 2 && (
          <>
            <p className="eyebrow">From student projects to experiments</p>
            <h2>
              A practice of
              <br />
              <em>making things work.</em>
            </h2>
            <p>
              StudyFlow brought planning, guidance, and progress into one
              student tool. With U2.7, I explored voice, memory, and multi-step
              desktop tasks.
            </p>
            <p>
              Working with Team BitWise on MemoryForge added another discipline:
              repeat the experiment, inspect the results, and make the behavior
              visible.
            </p>
            <details className="learning-details">
              <summary>Continuing my learning</summary>
              <ul>
                <li>
                  AI-first Software Engineering — Infosys Springboard, October
                  2026
                </li>
                <li>Prompt Engineering — Infosys Springboard, October 2026</li>
                <li>
                  Fundamentals of Information Security — Infosys Springboard,
                  October 2026
                </li>
                <li>
                  Claude Platform 101 & Claude Code 101 — Claude Academy,
                  October 2026
                </li>
              </ul>
            </details>
          </>
        )}
        {index === 3 && (
          <>
            <p className="eyebrow">A conversation is a good start</p>
            <h2>
              Bring a problem.
              <br />
              <em>Let’s explore it.</em>
            </h2>
            <p>
              I’m interested in AI applications, full-stack development, and
              thoughtful automation. You can find my code on GitHub or reach me
              directly.
            </p>
            <a className="sample-email" href="mailto:ved2032patel@gmail.com">
              ved2032patel@gmail.com
            </a>
            <div className="contact-links">
              <a
                href="https://github.com/VED2032PATEL"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/mortemxos/"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
            </div>
            <p className="education-note">
              Studying Computer Science
              <br />
              Shri Ram Institute of Technology, Jabalpur
            </p>
          </>
        )}
      </section>
    </div>
  );
}
