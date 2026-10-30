"use client";

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { loadBoardBankQuestion, showTexOnBoard } from '@/app/admin/board/actions';
import BankPicker from '@/components/board/BankPicker';
import BoardScreen, { type NextQuestion, type ShownQuestion } from '@/components/board/BoardScreen';
import TexInput, { type ChosenImage } from '@/components/board/TexInput';
import { useBankList } from '@/components/board/useBankList';
import type { BoardBankPage } from '@/app/admin/board/boardData';
import type { BankRow } from '@/components/board/types';
import { InfoTip } from '@/components/ui/InfoTip';
import { Page, PageHeader } from '@/components/ui/Page';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';

type Way = 'tex' | 'bank';

const OPEN_ERROR = 'The question could not be opened. Check the connection and try again.';

/** The picture a pasted `\image{…}` names, among the chosen files: by its name, or by the name alone without a folder. */
function findImage(images: ChosenImage[], wanted: string) {
  const name = wanted.trim().toLowerCase();
  const base = name.split(/[\\/]/).pop() ?? name;
  return (
    images.find((image) => image.name.toLowerCase() === name) ??
    images.find((image) => image.name.toLowerCase() === base) ??
    null
  );
}

/**
 * The optimizer only fetches from where the exam's pictures live (the
 * `remotePatterns` in next.config, or this site); anything else is drawn as
 * it is.
 */
function canOptimize(src: string) {
  return src.startsWith('/') || /^https:\/\/[^/]+\.supabase\.co\//.test(src);
}

/**
 * The admin Board: one question put up as on the test, for a teacher to solve
 * in class or on video. Two ways in - pasted .tex or the question bank - and
 * the board itself (`BoardScreen`), which covers the page while it is up.
 * Nothing here is saved anywhere: the pasted text and the chosen pictures
 * live in this component, and the pictures never leave the browser.
 */
export default function BoardApp({
  initialBank,
  referenceSheet,
}: {
  /** The bank's size and its count per search tile (no rows); null when it could not be read. */
  initialBank: BoardBankPage | null;
  referenceSheet: React.ReactNode;
}) {
  const [way, setWay] = useState<Way>('tex');
  const [shown, setShown] = useState<ShownQuestion | null>(null);
  const [isBoardVisible, setBoardVisible] = useState(false);
  // Where in the bank list the question on the board came from; null for a pasted one.
  const [bankIndex, setBankIndex] = useState<number | null>(null);
  const showingRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const [texDraft, setTexDraft] = useState('');
  const [images, setImages] = useState<ChosenImage[]>([]);
  const [texError, setTexError] = useState<{ message: string; line: number | null } | null>(null);
  const [isRendering, startRendering] = useTransition();
  // Every URL ever made here, revoked when the page goes: one still on the
  // board must keep working after "Clear images".
  const madeUrlsRef = useRef<string[]>([]);

  const bank = useBankList(initialBank);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [next, setNext] = useState<{ isLoading: boolean; error: string | null }>({ isLoading: false, error: null });

  useEffect(() => {
    const made = madeUrlsRef.current;
    return () => {
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, []);

  const openBoard = (question: Omit<ShownQuestion, 'key'>) => {
    showingRef.current += 1;
    setShown({ ...question, key: String(showingRef.current) });
    if (!isBoardVisible) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setBoardVisible(true);
    }
  };

  const closeBoard = () => {
    setBoardVisible(false);
    setNext({ isLoading: false, error: null });
    // After the page behind the board is no longer inert (`BoardScreen`).
    const target = returnFocusRef.current;
    setTimeout(() => {
      if (target?.isConnected) target.focus();
    }, 0);
  };

  /* ---------------------------------------------------------- .tex */

  const chooseImages = (files: FileList) => {
    const chosen = Array.from(files).map((file) => {
      const url = URL.createObjectURL(file);
      madeUrlsRef.current.push(url);
      return { name: file.name, url };
    });
    // A file chosen again under the same name replaces the old one.
    setImages((current) => [
      ...current.filter((image) => !chosen.some((item) => item.name.toLowerCase() === image.name.toLowerCase())),
      ...chosen,
    ]);
  };

  const showTex = () => {
    startRendering(async () => {
      let result;
      try {
        result = await showTexOnBoard(texDraft);
      } catch {
        setTexError({ message: OPEN_ERROR, line: null });
        return;
      }
      if (!result.ok) {
        setTexError({ message: result.error, line: result.line });
        return;
      }

      const { question, imageLine } = result;
      let imageSrc: string | null = null;
      if (question.imageName) {
        if (/^https?:\/\//i.test(question.imageName)) {
          imageSrc = question.imageName;
        } else {
          const image = findImage(images, question.imageName);
          if (!image) {
            setTexError({
              message: `The question shows \\image{${question.imageName}}. Choose that file under Images, or take the \\image line out.`,
              line: imageLine,
            });
            return;
          }
          imageSrc = image.url;
        }
      }

      setTexError(null);
      setBankIndex(null);
      openBoard({
        question,
        imageSrc,
        imageUnoptimized: imageSrc !== null && !canOptimize(imageSrc),
        number: 1,
        tags: null,
      });
    });
  };

  /* ---------------------------------------------------------- bank */

  /** Puts the question at `index` of `rows` on the board; false when it could not be opened. */
  const showBankQuestion = async (rows: BankRow[], index: number) => {
    const row = rows[index];
    if (!row) return OPEN_ERROR;
    let result;
    try {
      result = await loadBoardBankQuestion(row.id);
    } catch {
      return OPEN_ERROR;
    }
    if (!result.ok) return result.error;

    const { question, tags } = result;
    setBankIndex(index);
    openBoard({
      question,
      imageSrc: question.imageUrl,
      imageUnoptimized: question.imageUrl !== null && !canOptimize(question.imageUrl),
      number: index + 1,
      tags,
    });
    return null;
  };

  const pickBankQuestion = async (index: number) => {
    const row = bank.rows[index];
    if (!row || pendingId) return;
    setPendingId(row.id);
    setPickError(null);
    const error = await showBankQuestion(bank.rows, index);
    setPendingId(null);
    if (error) setPickError(error);
  };

  const nextIndex = bankIndex === null ? null : bankIndex + 1;
  const isLast = nextIndex !== null && nextIndex >= bank.total && nextIndex >= bank.rows.length;

  const goToNext = async () => {
    if (nextIndex === null || isLast || next.isLoading) return;
    setNext({ isLoading: true, error: null });
    let rows = bank.rows;
    if (nextIndex >= rows.length) {
      const more = await bank.loadMore();
      if (!more) {
        setNext({ isLoading: false, error: OPEN_ERROR });
        return;
      }
      // The list came back shorter than counted - questions deleted since it
      // loaded. Its new total now marks this one as the last, which is no
      // connection problem to report.
      if (nextIndex >= more.length) {
        setNext({ isLoading: false, error: null });
        return;
      }
      rows = more;
    }
    const error = await showBankQuestion(rows, nextIndex);
    setNext({ isLoading: false, error });
  };

  const nextQuestion: NextQuestion | null =
    bankIndex === null ? null : { onNext: () => void goToNext(), isLoading: next.isLoading, isLast, error: next.error };

  return (
    <>
      <Page>
        {/* The explanation behind an "i" and the way in level with the title
            (the owner's call): the question's fields start right under it. */}
        <PageHeader
          title="Board"
          info={
            <InfoTip label="About the Board">
              One question as on the test, with the calculator, the reference sheet and the whiteboard, for solving it
              in class or on video. No timer, and nothing is saved.
            </InfoTip>
          }
          actions={
            <div className={segmentedClass}>
              <button type="button" aria-pressed={way === 'tex'} onClick={() => setWay('tex')} className={segmentClass(way === 'tex')}>
                Paste .tex
              </button>
              <button type="button" aria-pressed={way === 'bank'} onClick={() => setWay('bank')} className={segmentClass(way === 'bank')}>
                Question bank
              </button>
            </div>
          }
        />

        {way === 'tex' ? (
          <TexInput
            value={texDraft}
            onChange={setTexDraft}
            images={images}
            onChooseImages={chooseImages}
            onClearImages={() => setImages([])}
            error={texError}
            isRendering={isRendering}
            onShow={showTex}
          />
        ) : (
          <BankPicker
            filter={bank.filter}
            rows={bank.rows}
            total={bank.total}
            hasSearched={bank.hasSearched}
            needsChoice={bank.needsChoice}
            bankTotal={bank.bankTotal}
            counts={bank.counts}
            isSearching={bank.isSearching}
            isLoadingMore={bank.isLoadingMore}
            error={bank.error}
            pickError={pickError}
            pendingId={pendingId}
            onQueryChange={bank.setQuery}
            onToggleDomain={bank.toggleDomain}
            onToggleDifficulty={bank.toggleDifficulty}
            onClearFilter={bank.clearFilter}
            onSearch={() => {
              setPickError(null);
              bank.submit();
            }}
            onRetry={bank.retry}
            onLoadMore={() => void bank.loadMore()}
            onPick={(index) => void pickBankQuestion(index)}
          />
        )}
      </Page>

      {shown && (
        <BoardScreen
          shown={shown}
          isVisible={isBoardVisible}
          referenceSheet={referenceSheet}
          onNewQuestion={closeBoard}
          next={nextQuestion}
        />
      )}
    </>
  );
}
