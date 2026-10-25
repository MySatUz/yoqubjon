import React from 'react';
// The sheet can be opened from a start screen, before the question pane that
// also loads this has been on screen.
import 'katex/dist/katex.min.css';
import { renderMathText } from '@/lib/renderMathText';

/**
 * The SAT Math reference sheet, as the College Board prints it: the same
 * figures, the same formulas, the same three facts - nothing more, so what a
 * student learns to find here is what they will find on the day.
 *
 * A server component, passed down to the exam's reference window as rendered
 * content: its formulas are typeset by KaTeX here, so the exam bundle still
 * carries no KaTeX (see `ExamRunner`), and "l" is the script ℓ of the real
 * sheet instead of a sans-serif l that reads as a capital I. Never import this
 * from a client component.
 */

/** Inline maths. */
function m(tex: string) {
  return renderMathText(`\\(${tex}\\)`);
}

/*
 * Every figure is drawn at its real size - a 148 x 100 box, never scaled - so
 * its labels keep their size too: `text-xs` under KaTeX's 1.21em is 14.5px.
 * Lines take the text colour; nothing is tinted.
 */
const FIGURE_WIDTH = 148;
const FIGURE_HEIGHT = 100;

type Label = { x: number; y: number; tex: string };

/**
 * One figure with its formulas under it. The two special right triangles
 * have no formula, so they are named under the figure instead, as on the
 * printed sheet.
 *
 * The figure and its labels are hidden from screen readers; where the labels
 * are the content - the sides of the special right triangles - `spoken` says
 * them instead.
 */
function Figure({
  name,
  labels,
  formulas = [],
  spoken,
  children,
}: {
  name: string;
  labels: Label[];
  formulas?: string[];
  spoken?: string;
  children: React.ReactNode;
}) {
  return (
    // Narrower sides in a sheet under 22rem - a 360px phone - so two 148px
    // figures still fit side by side there without spilling over the frame.
    <figure className="flex flex-col items-center rounded-xl border border-mist-200 px-1 pb-3 pt-4 @[22rem]:px-2.5">
      <div className="relative text-mist-700" style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT }}>
        <svg
          viewBox={`0 0 ${FIGURE_WIDTH} ${FIGURE_HEIGHT}`}
          width={FIGURE_WIDTH}
          height={FIGURE_HEIGHT}
          className="absolute inset-0 overflow-visible"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinejoin="round"
          aria-hidden
        >
          {children}
        </svg>
        {labels.map((label) => (
          <span
            key={`${label.tex}-${label.x}-${label.y}`}
            aria-hidden
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs leading-none text-mist-900"
            style={{ left: label.x, top: label.y }}
          >
            {m(label.tex)}
          </span>
        ))}
      </div>
      {formulas.length > 0 ? (
        <figcaption className="mt-3 space-y-1 text-center text-sm text-mist-900">
          <span className="sr-only">{name}: </span>
          {formulas.map((formula) => (
            <span key={formula} className="block">
              {m(formula)}
            </span>
          ))}
        </figcaption>
      ) : (
        <figcaption className="mt-3 text-center text-xs text-mist-500">
          {name}
          {spoken && <span className="sr-only">: {spoken}</span>}
        </figcaption>
      )}
    </figure>
  );
}

/** The small square that marks a right angle, with its corner at (x, y). */
function RightAngle({ x, y, dx, dy }: { x: number; y: number; dx: number; dy: number }) {
  return <path d={`M${x} ${y + dy} H${x + dx} V${y}`} strokeWidth={1.25} />;
}

const DASH = '4 3';

export default function ReferenceSheet() {
  return (
    // A container, so the sheet lays itself out by the window's width rather
    // than the screen's.
    <div className="@container space-y-3">
      {/* Two columns in the window's opening width and on a phone; three
          once the window is widened enough for three 172px figures. One
          below 20rem (a 320px phone), where two would overlap. */}
      <div className="grid grid-cols-1 gap-2 @[20rem]:grid-cols-2 @xl:grid-cols-3">
        <Figure
          name="Circle"
          labels={[{ x: 92, y: 42, tex: 'r' }]}
          formulas={['A = \\pi r^2', 'C = 2\\pi r']}
        >
          <circle cx="74" cy="50" r="38" />
          <path d="M74 50 H112" />
          <circle cx="74" cy="50" r="2" fill="currentColor" stroke="none" />
        </Figure>

        <Figure
          name="Rectangle"
          labels={[
            { x: 72, y: 88, tex: '\\ell' },
            { x: 132, y: 46, tex: 'w' },
          ]}
          formulas={['A = \\ell w']}
        >
          <rect x="24" y="18" width="96" height="56" />
        </Figure>

        <Figure
          name="Triangle"
          labels={[
            { x: 47, y: 52, tex: 'h' },
            { x: 74, y: 92, tex: 'b' },
          ]}
          formulas={['A = \\dfrac{1}{2}bh']}
        >
          <path d="M16 80 H132 L56 18 Z" />
          <path d="M56 18 V80" strokeDasharray={DASH} strokeWidth={1.25} />
          <RightAngle x={56} y={80} dx={8} dy={-8} />
        </Figure>

        <Figure
          name="Right triangle"
          labels={[
            { x: 14, y: 49, tex: 'a' },
            { x: 74, y: 92, tex: 'b' },
            { x: 82, y: 42, tex: 'c' },
          ]}
          formulas={['c^2 = a^2 + b^2']}
        >
          <path d="M24 80 V18 L124 80 Z" />
          <RightAngle x={24} y={80} dx={8} dy={-8} />
        </Figure>

        <Figure
          name="30°-60°-90° triangle"
          spoken="the side opposite 30° is x, the side opposite 60° is x times the square root of 3, and the hypotenuse is 2x"
          labels={[
            { x: 13, y: 49, tex: 'x' },
            { x: 81, y: 94, tex: 'x\\sqrt{3}' },
            { x: 88, y: 39, tex: '2x' },
            { x: 39, y: 43, tex: '60^\\circ' },
            { x: 101, y: 74, tex: '30^\\circ' },
          ]}
        >
          <path d="M24 82 V16 L138 82 Z" />
          <RightAngle x={24} y={82} dx={8} dy={-8} />
        </Figure>

        <Figure
          name="45°-45°-90° triangle"
          spoken="both legs are s, and the hypotenuse is s times the square root of 2"
          labels={[
            { x: 12, y: 48, tex: 's' },
            { x: 60, y: 96, tex: 's' },
            { x: 76, y: 38, tex: 's\\sqrt{2}' },
            { x: 37, y: 53, tex: '45^\\circ' },
            { x: 70, y: 77, tex: '45^\\circ' },
          ]}
        >
          <path d="M22 86 V10 L98 86 Z" />
          <RightAngle x={22} y={86} dx={8} dy={-8} />
        </Figure>

        <Figure
          name="Rectangular solid"
          labels={[
            { x: 56, y: 91, tex: '\\ell' },
            { x: 118, y: 77, tex: 'w' },
            { x: 134, y: 35, tex: 'h' },
          ]}
          formulas={['V = \\ell wh']}
        >
          <path d="M16 34 H96 V80 H16 Z M16 34 L44 12 H124 L96 34 M124 12 V58 L96 80" />
          <path d="M16 80 L44 58 H124 M44 58 V12" strokeDasharray={DASH} strokeWidth={1.25} />
        </Figure>

        <Figure
          name="Cylinder"
          labels={[
            { x: 94, y: 20, tex: 'r' },
            { x: 125, y: 54, tex: 'h' },
          ]}
          formulas={['V = \\pi r^2 h']}
        >
          <ellipse cx="74" cy="26" rx="40" ry="14" />
          <path d="M34 26 V80 A40 14 0 0 0 114 80 V26" />
          <path d="M34 80 A40 14 0 0 1 114 80" strokeDasharray={DASH} strokeWidth={1.25} />
          <path d="M74 26 H114" />
          <circle cx="74" cy="26" r="2" fill="currentColor" stroke="none" />
        </Figure>

        <Figure
          name="Sphere"
          labels={[{ x: 80, y: 30, tex: 'r' }]}
          formulas={['V = \\dfrac{4}{3}\\pi r^3']}
        >
          <circle cx="74" cy="50" r="38" />
          <path d="M36 50 A38 10 0 0 0 112 50" />
          <path d="M36 50 A38 10 0 0 1 112 50" strokeDasharray={DASH} strokeWidth={1.25} />
          <path d="M74 50 L101 23" />
          <circle cx="74" cy="50" r="2" fill="currentColor" stroke="none" />
        </Figure>

        <Figure
          name="Cone"
          labels={[
            { x: 66, y: 46, tex: 'h' },
            { x: 98, y: 72, tex: 'r' },
          ]}
          formulas={['V = \\dfrac{1}{3}\\pi r^2 h']}
        >
          <path d="M30 78 L74 10 L118 78" />
          <path d="M30 78 A44 14 0 0 0 118 78" />
          <path d="M30 78 A44 14 0 0 1 118 78" strokeDasharray={DASH} strokeWidth={1.25} />
          <path d="M74 10 V78" strokeDasharray={DASH} strokeWidth={1.25} />
          <path d="M74 78 H118" />
          <RightAngle x={74} y={78} dx={7} dy={-7} />
        </Figure>

        <Figure
          name="Pyramid"
          labels={[
            { x: 58, y: 90, tex: '\\ell' },
            { x: 123, y: 73, tex: 'w' },
            { x: 64, y: 44, tex: 'h' },
          ]}
          formulas={['V = \\dfrac{1}{3}\\ell wh']}
        >
          <path d="M16 78 H100 L128 58 M16 78 L72 10 L100 78 M72 10 L128 58" />
          <path d="M16 78 L44 58 H128 M44 58 L72 10 M72 10 V68" strokeDasharray={DASH} strokeWidth={1.25} />
        </Figure>
      </div>

      <ul className="space-y-1.5 rounded-xl border border-mist-200 px-4 py-3 text-sm text-mist-700">
        <li>The number of degrees of arc in a circle is {m('360')}.</li>
        <li>The number of radians of arc in a circle is {m('2\\pi')}.</li>
        <li>The sum of the measures in degrees of the angles of a triangle is {m('180')}.</li>
      </ul>
    </div>
  );
}
