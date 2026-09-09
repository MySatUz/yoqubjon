# TEX Question Import Format

This project imports practice questions from `.tex` files using one canonical structure. The importer preserves LaTeX math and validates every math fragment with KaTeX before saving the test.

## Supported structure

Each question must use a `question` environment:

```tex
\begin{question}
  \content{The function \( f(x) = x^2 - 4x + 3 \). What is \( f(5) \)?}
  \image{example.png}
  \options{
    A: 4
    B: 6
    C: 8
    D: 12
  }
  \answer{C}
\end{question}
```

## Required tags

- `\content{...}`: required. Main question text.
- `\answer{...}`: required. For multiple choice use `A`, `B`, `C`, `D`, several
  letters separated by commas for a multi-select question, or the final
  displayed answer value for a grid-in.

## Optional tags

- `\image{file-name.png}`: optional. Image filename that matches one of the uploaded files.
- `\options{...}`: optional. If omitted, the question is treated as a student-produced response.

## Math formatting rules

Preferred math delimiters:

- Inline math: `\( ... \)`
- Block math: `\[ ... \]`

Also supported:

- Inline math with `$ ... $`
- Block math with `$$ ... $$`

Examples:

```tex
\content{If \( x + 3 = 10 \), what is \( x \)?}
\content{Solve \[ x^2 - 9 = 0 \]}
```

Use KaTeX-compatible math. These structures are good for SAT-style questions:

```tex
\content{
Solve the system:
\[
\begin{cases}
2x+y=9\\
x-y=3
\end{cases}
\]
}
```

```tex
\content{
The table shows values of \(x\) and \(f(x)\):
\[
\begin{array}{c|cccc}
x & 1 & 2 & 3 & 4\\
\hline
f(x) & 3 & 7 & 11 & 15
\end{array}
\]
}
```

For tables, prefer `array` inside display math. Avoid `tabular`; it is a document-layout environment and does not render reliably in the test interface.

## Option formatting rules

Inside `\options{...}`, every option must start on its own line:

```tex
\options{
  A: Option one
  B: Option two
  C: Option three
  D: Option four
}
```

The parser also accepts `A)`, `A.`, and `\item[A]` labels:

```tex
\options{
  A) \(x=2\)
  B) \(x=3\)
  C) \(x=4\)
  D) \(x=5\)
}
```

Do not place two options on one line.

## Modules (SAT format)

A test can be split into SAT-style modules. Every module has its own timer, and
time left over in one module is never added to the next one.

Mark the split with `\module{N}` before the questions of that module:

```tex
\module{1}
\begin{question} ... \end{question}
% 22 questions of module 1

\module{2}
\begin{question} ... \end{question}
% 22 questions of module 2
```

Equivalent forms:

- `\newmodule` between two question blocks starts the next module.
- `\begin{module} ... \end{module}` wraps the questions of one module. The first
  wrapper is module 1, each following wrapper is the next module.

Rules:

- Modules must be numbered from 1 upwards without gaps, and every module needs
  at least one question.
- A test can have up to 6 modules.
- Question numbering restarts at 1 inside each module in the test interface.
- When the file has module markers, the test must be uploaded with the
  "SAT modules" format selected; the per-module time comes from the upload form.
- Without markers, the file stays a single-module test, or the upload form
  splits the questions by the counts entered per module (default 22 + 22).

## Multiple correct answers

List the letters in `\answer{...}`, separated by commas. Nothing else changes —
the same `\options{...}` block, the same everything:

```tex
\begin{question}
  \content{Select all values of \( x \) that satisfy \( x^2 - 5x + 6 = 0 \).}
  \options{
    A: 1
    B: 2
    C: 3
    D: 4
  }
  \answer{B, C}
\end{question}
```

The student sees square choice markers instead of round ones, a "Select all that
apply" caption, and can tick as many options as they like. The number of correct
answers is never shown.

Rules:

- Two or more letters make the question multi-select. One letter is an ordinary
  single-choice question.
- Order and spacing do not matter: `\answer{C, B}` and `\answer{B,C}` are the
  same key. The importer stores it sorted.
- Every letter must name an existing option, and no letter may repeat.
- A letter list needs `\options{...}`. Without it the upload fails rather than
  quietly storing `B, C` as a grid-in value.
- A grid-in value that contains a comma is unaffected: `\answer{1,000}` is a
  number, not options A and C.

### Partial credit

A multi-select question is not all-or-nothing. Each right option earns a share
of the mark and each wrong one gives that share back:

```
credit = (chosen right − chosen wrong) / (number of right options)
```

clamped to the range 0…1. With `\answer{B, C}` out of four options: `B, C`
earns 1, `B` alone earns 0.5, `B, C, D` earns 0.5, and ticking all four earns 0
— which is the point of subtracting the wrong picks.

Only a fully correct answer counts as correct in the review view; everything
between is shown as partial credit. Scores and the olympiad ranking add up the
credit, so a result can read `17.5 / 22`.

## Grid-in questions

For open numeric answers, omit `\options{...}`:

```tex
\begin{question}
  \content{What is the value of \( 12 \times 8 \)?}
  \answer{96}
\end{question}
```

## Best practices

- Keep one logical question per `\begin{question}...\end{question}` block.
- Use uploaded image names exactly, including extension.
- Prefer `\text{...}` inside math mode when you need units such as `\(\text{cm}^2\)`.
- Keep prose outside math mode whenever possible.
- Use plain answer values for grid-in questions, for example `12`, `96`, `\dfrac{292}{3}`.
- Use `\%` for a literal percent sign. A plain `%` starts a comment and the importer ignores the rest of that line.
- Use `\{` and `\}` for literal braces inside text.

## Parser validation

The importer reads:

1. `\content{...}`
2. optional `\image{...}`
3. optional `\options{...}`
4. `\answer{...}`

Before saving the test, it checks:

- every question has content and an answer;
- multiple-choice answers point to an existing option;
- a multi-select answer names each option at most once;
- a list of answer letters belongs to a question that has options;
- option blocks contain at least two options;
- math delimiters are closed;
- formulas are valid KaTeX.

If you keep to this format, the converter will stay predictable and the rendered questions will display math correctly in both the test view and the review view.
