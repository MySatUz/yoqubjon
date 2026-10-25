"use client";

import React, { useState } from 'react';
import { Video } from 'lucide-react';
import { buttonClass } from '@/components/ui/Button';

export default function VideoClient({ url }: { url: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={buttonClass({ variant: 'secondary', size: 'sm' })}
      >
        <Video className="h-4 w-4" />
        {isOpen ? 'Hide explanation' : 'Watch explanation'}
      </button>

      {isOpen && (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-mist-200 bg-mist-900">
          <iframe
            src={url}
            title="Explanation video"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}
    </>
  );
}
