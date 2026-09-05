export const CHAPTERS = ['About', 'Selected work', 'Say hello'] as const;

export function PortfolioContent({ index }: { index: number }) {
  return (
    <div className="chapter-layout">
      <section className="chapter-left">
        <p className="eyebrow">
          {
            [
              'A little introduction',
              'Ideas, made real',
              'The next good thing',
            ][index]
          }
        </p>
        <h1>
          {index === 0 && (
            <>
              Digital.
              <br />
              <span className="serif-word">Human.</span>
              <br />
              Always
              <br />
              curious.
            </>
          )}
          {index === 1 && (
            <>
              Made to
              <br />
              <span className="serif-word">matter.</span>
            </>
          )}
          {index === 2 && (
            <>
              Have a<br />
              <span className="serif-word">wild idea?</span>
            </>
          )}
        </h1>
        <p className="chapter-intro">
          {
            [
              'A designer & developer exploring the space between thoughtful design and playful technology.',
              'A few experiments in identity, digital experiences, and the small details that make them memorable.',
              'Let’s turn that thing you can’t stop thinking about into something people can experience.',
            ][index]
          }
        </p>
      </section>
      <section className="chapter-right" aria-label={CHAPTERS[index]}>
        <span className="chapter-number">
          0{index + 1}
          <span> / 03</span>
        </span>
        {index === 0 && (
          <>
            <p className="eyebrow">Thoughtful work. A playful spirit.</p>
            <h2>
              Good design
              <br />
              has a <em>personality.</em>
            </h2>
            <p>
              I build brands and digital experiences with clarity, craft, and a
              little unexpected delight.
            </p>
            <div className="detail-list">
              <p>
                <span>01</span> Design & direction
              </p>
              <p>
                <span>02</span> Creative development
              </p>
              <p>
                <span>03</span> Interactive experiences
              </p>
            </div>
            <p className="availability">
              <span /> Open to interesting collaborations
            </p>
          </>
        )}
        {index === 1 && (
          <>
            <p className="eyebrow">Selected explorations</p>
            <div className="project-item">
              <span>01 — BRAND & DIGITAL</span>
              <h2>Orbit Studio</h2>
              <p>A fresh identity for ideas that refuse to stand still.</p>
            </div>
            <div className="project-item">
              <span>02 — WEB EXPERIENCE</span>
              <h2>Forma Objects</h2>
              <p>A quiet digital home for everyday objects with character.</p>
            </div>
            <div className="project-item">
              <span>03 — CREATIVE CODE</span>
              <h2>The Playground</h2>
              <p>Small experiments. New possibilities. Plenty of curiosity.</p>
            </div>
          </>
        )}
        {index === 2 && (
          <>
            <p className="eyebrow">Start a conversation</p>
            <h2>
              Something great
              <br />
              starts with <em>hello.</em>
            </h2>
            <p>
              New projects, collaborations, or a good conversation. There’s room
              for all of them.
            </p>
            <p className="sample-email">hello@example.com</p>
            <div className="detail-list">
              <p>
                <span>BASED</span> Somewhere on Earth
              </p>
              <p>
                <span>WORKING</span> Everywhere, together
              </p>
            </div>
            <p className="availability">
              <span /> Available for the right project
            </p>
          </>
        )}
      </section>
    </div>
  );
}
