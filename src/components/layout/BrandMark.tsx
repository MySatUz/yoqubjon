import Image from 'next/image';

/**
 * The one logo, shared by the sidebar, the mobile header, the exam bar and the
 * public pages: the owner's crowned snake climbing a rising line, in a white
 * disc with an ink-blue ring (the site kit of 2026-10-27). The disc is white
 * on every ground, so the same file sits on light pages and on the navy
 * sidebar.
 *
 * It is a picture, not a drawing on `currentColor`, so it is served as a small
 * file already sized for 2x screens (`public/brand/mark-96.webp`, and
 * `mark-128.webp` for the 56px `lg` of the landing header, both cut from the
 * kit's `mark.png`) and bypasses the image optimizer, whose monthly
 * transformations are kept for question images. The browser tab icon
 * (favicon.ico, icon.png), apple-icon.png, the manifest icons and the link
 * preview (public/brand/social-card.png) come from the same kit.
 */
export default function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 32 : size === 'md' ? 40 : 56;
  return (
    <Image
      src={size === 'lg' ? '/brand/mark-128.webp' : '/brand/mark-96.webp'}
      width={px}
      height={px}
      alt=""
      unoptimized
      loading="eager"
      className="shrink-0 rounded-full"
    />
  );
}
