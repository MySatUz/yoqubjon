# TEX Question Import Format

This project imports practice questions from `.tex` files using one canonical structure.

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
- `\answer{...}`: required. For multiple choice use `A`, `B`, `C`, `D` or the final displayed answer value.

## Optional tags

- `\image{file-name.png}`: optional. Image filename that matches one of the uploaded files.
- `\options{...}`: optional. If omitted, the question is treated as a student-produced response.

## Math formatting rules

Preferred math delimiters:

- Inline math: `\( ... \)`
- Block math: `\[ ... \]`

Also supported:

- Inline math with `$ ... $`

Examples:

```tex
\content{If \( x + 3 = 10 \), what is \( x \)?}
\content{Solve \[ x^2 - 9 = 0 \]}
```

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

Do not place two options on one line.

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

## Current parser expectations

The importer currently reads:

1. `\content{...}`
2. optional `\image{...}`
3. optional `\options{...}`
4. `\answer{...}`

If you keep to this format, the converter will stay predictable and the rendered questions will display math correctly in both the test view and the review view.
