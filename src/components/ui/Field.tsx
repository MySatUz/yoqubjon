import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/components/ui/cn';

/**
 * The one focus treatment for text controls: a solid 2px of the accent (the
 * border plus a 1px ring). The old ink-100 ring was 1.22:1 against white,
 * so a focused field looked almost the same as an idle one.
 */
export const fieldFocusClass = 'focus:border-ink-600 focus:ring-1 focus:ring-ink-600';

/*
 * gray-400 border and gray-500 placeholder: a control's edge is a step darker
 * than a card's (gray-200), so a field is found on a white card before it is
 * hovered, and a placeholder that carries a hint has to be readable (gray-400
 * is 2.4:1). Card borders stay gray-200.
 *
 * `focus:outline-hidden`, not `outline-none`: in Tailwind v4 `outline-none`
 * removes the outline outright, and Windows high-contrast mode, which repaints
 * the border and drops the box-shadow ring, then showed no focus at all.
 * `outline-hidden` hides the browser's ring like before, but in forced colours
 * it is a transparent outline that the system colours make visible. Only on
 * focus: a resting field would wear it too.
 */
const control =
  'w-full rounded-lg border border-gray-400 bg-white text-sm text-gray-900 transition-colors focus:outline-hidden ' +
  'placeholder:text-gray-500 hover:border-gray-500 ' + fieldFocusClass + ' ' +
  'disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-500 ' +
  'aria-invalid:border-red-600 aria-invalid:focus:ring-red-600';

/**
 * One control height for the whole app: h-9, or h-10 on the auth forms, and
 * h-11 for both on a coarse pointer, level with the buttons (Button.tsx). `lg`
 * is 16px on phones: iOS zooms the page into any field set smaller than that.
 * `trailing` keeps room on the right for a button inside the field (the
 * password's show/hide), without a second padding class fighting px-3.
 */
const controlHeights = {
  md: 'h-9 pointer-coarse:h-11',
  lg: 'h-10 pointer-coarse:h-11',
};

export function inputClass({
  size = 'md',
  trailing = false,
  className,
}: { size?: 'md' | 'lg'; trailing?: boolean; className?: string } = {}) {
  return cn(
    control,
    controlHeights[size],
    size === 'lg' && 'max-sm:text-base',
    trailing ? 'pl-3 pr-11' : 'px-3',
    className,
  );
}

/**
 * `appearance-none`: the system arrow differs on every platform (a grey
 * double caret on macOS, a heavy black one on Windows) and ignores the
 * palette, so <Select> draws its own chevron in the room pr-8 keeps. Use
 * <Select> rather than this class on a bare <select>, which would be left
 * with no arrow at all.
 */
export function selectClass({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string } = {}) {
  return cn(control, controlHeights[size], size === 'lg' && 'max-sm:text-base', 'appearance-none pl-3 pr-8', className);
}

export function textareaClass({ className }: { className?: string } = {}) {
  return cn(control, 'min-h-20 px-3 py-2 leading-6', className);
}

/*
 * A field with a unit inside its border ("35 minutes"). The border, hover and
 * focus are drawn by the box, on `focus-within`, because the focus lands on
 * the bare input inside; the error and disabled states follow the input
 * through `has-*`. Same colours and heights as `control` above.
 */
const affixBox =
  'flex w-full items-center gap-2 rounded-lg border border-gray-400 bg-white px-3 text-sm transition-colors ' +
  'hover:border-gray-500 focus-within:border-ink-600 focus-within:ring-1 focus-within:ring-ink-600 ' +
  'has-disabled:cursor-not-allowed has-disabled:border-gray-200 has-disabled:bg-gray-50 ' +
  'has-aria-invalid:border-red-600 has-aria-invalid:focus-within:ring-red-600';
const affixInput =
  'h-full w-full min-w-0 flex-1 bg-transparent text-gray-900 placeholder:text-gray-500 focus:outline-hidden ' +
  'disabled:cursor-not-allowed disabled:text-gray-500';
/** A unit is text the user reads, so gray-500 like a placeholder, not the 400 of an icon. */
const affixUnit = 'shrink-0 text-xs text-gray-500';

/* A native checkbox tinted with accent-color. The `rounded border-slate-300
   text-blue-600` it used to carry were for the forms plugin, which this app
   does not load: the browser draws the box and ignored them. */
export const checkboxClass =
  'h-4 w-4 shrink-0 accent-ink-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600';

/* ComponentProps<'input'> and friends include `ref`, which React 19 passes to
   a function component as a plain prop: the spreads below hand it on. */
type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: 'md' | 'lg';
  /**
   * A unit drawn inside the field's border, after the value ("minutes",
   * "attempts"). With an `id` it is a second <label> for the input, so a
   * click on it focuses the field and a screen reader hears the unit with the
   * name. Without one (an input named by `aria-label`) the whole box is the
   * <label>, for the same click. `className` then goes on the box (layout
   * only, as everywhere).
   */
  suffix?: React.ReactNode;
};

export function Input({ size = 'md', suffix, className, ...props }: InputProps) {
  if (suffix === undefined || suffix === null || suffix === false) {
    return <input className={inputClass({ size, className })} {...props} />;
  }

  const boxClass = cn(affixBox, controlHeights[size], size === 'lg' && 'max-sm:text-base', className);

  if (!props.id) {
    return (
      <label className={boxClass}>
        <input className={affixInput} {...props} />
        <span className={affixUnit}>{suffix}</span>
      </label>
    );
  }

  return (
    <div className={boxClass}>
      <input className={affixInput} {...props} />
      <label htmlFor={props.id} className={affixUnit}>
        {suffix}
      </label>
    </div>
  );
}

type SelectProps = Omit<React.ComponentProps<'select'>, 'size'> & { size?: 'md' | 'lg' };

/**
 * The chevron is gray-500, darker than the gray-400 of an icon inside a
 * field: it is what tells a select from a text box before anyone presses it.
 * pointer-events-none, so a click on it still opens the list. `className`
 * goes on the wrapper (layout only), which holds the chevron in place.
 */
export function Select({ size, className, ...props }: SelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(selectClass({ size }), 'peer')} {...props} />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 peer-disabled:text-gray-400"
      />
    </div>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={textareaClass({ className })} {...props} />;
}

export const labelClass = 'block text-sm font-medium text-gray-700';
export const hintClass = 'text-xs text-gray-500';
export const errorTextClass = 'text-xs text-red-600';

type DescribableProps = {
  id?: string;
  children?: React.ReactNode;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
};

type Description = { controlId: string; messageId: string; invalid: boolean };

/** `own` plus the message id, once: a control may already point at the same hint. */
function joinIds(own: string | undefined, messageId: string) {
  const ids = own ? own.split(/\s+/).filter(Boolean) : [];
  return ids.includes(messageId) ? ids.join(' ') : [...ids, messageId].join(' ');
}

function describe(element: React.ReactElement<DescribableProps>, description: Description) {
  return React.cloneElement(element, {
    'aria-describedby': joinIds(element.props['aria-describedby'], description.messageId),
    'aria-invalid': description.invalid ? true : element.props['aria-invalid'],
  });
}

/**
 * Finds the element whose `id` is the label's `htmlFor` anywhere in the
 * children - the control itself, or an input inside a wrapper (a row with a
 * button beside the input, an affix box) - and gives it the description.
 * Elements on the way are copied only when the control is below them.
 */
function describeById(node: React.ReactNode, description: Description): { node: React.ReactNode; found: boolean } {
  if (Array.isArray(node)) {
    let found = false;
    const next = node.map((child) => {
      if (found) return child;
      const result = describeById(child, description);
      found = result.found;
      return result.node;
    });
    return found ? { node: next, found } : { node, found };
  }

  if (!React.isValidElement<DescribableProps>(node)) return { node, found: false };
  if (node.props.id === description.controlId) return { node: describe(node, description), found: true };
  if (node.props.children === undefined) return { node, found: false };

  const inner = describeById(node.props.children, description);
  return inner.found ? { node: withChildren(node, inner.node), found: true } : { node, found: false };
}

/*
 * Children go back as separate arguments, the way JSX passes them, not as one
 * array: React takes an array for a list and would ask the unkeyed copy of the
 * control for a key.
 */
function withChildren(element: React.ReactElement, children: React.ReactNode) {
  return Array.isArray(children)
    ? React.cloneElement(element, undefined, ...children)
    : React.cloneElement(element, undefined, children);
}

/**
 * Label above a control, with an optional hint or error below. Sentence-case
 * labels — the uppercase, letter-spaced micro-labels are gone.
 *
 * With `htmlFor`, the hint or error gets an id and the control is given
 * `aria-describedby` pointing at it (and `aria-invalid` while there is an
 * error), so a screen reader reads the rule or the problem with the field.
 * The control is found by that id, however deep it sits in the children. A
 * component that renders its input out of sight (its id not among the
 * children's props) gets the props itself, to pass on.
 * `aside` sits at the end of the label row - the place a "Forgot password?"
 * link is looked for.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  aside,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const messageId = htmlFor && (error || hint) ? `${htmlFor}-${error ? 'error' : 'hint'}` : undefined;
  let control = children;
  if (htmlFor && messageId) {
    const description = { controlId: htmlFor, messageId, invalid: Boolean(error) };
    const result = describeById(children, description);
    if (result.found) {
      control = Array.isArray(result.node)
        ? React.createElement(React.Fragment, null, ...result.node)
        : result.node;
    } else if (
      React.isValidElement<DescribableProps>(children) &&
      typeof children.type !== 'string' &&
      // A fragment takes no props but key: React would warn about the aria ones.
      children.type !== React.Fragment
    ) {
      control = describe(children, description);
    }
  }

  const labelNode = (
    <label htmlFor={htmlFor} className={labelClass}>
      {label}
    </label>
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      {aside ? (
        <div className="flex items-baseline justify-between gap-3">
          {labelNode}
          {aside}
        </div>
      ) : (
        labelNode
      )}
      {control}
      {error ? (
        <p id={messageId} className={errorTextClass}>
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className={hintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
