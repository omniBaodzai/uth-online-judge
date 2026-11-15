import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import assistantImage from "../../assets/assistant.webp";
import { ApiError, request as publicRequest } from "../auth/api";
import { useAuth } from "../auth/useAuth";
import { InvalidAiAssistantResponseError, sendAiAssistantMessage } from "./api";
import type { AiAssistantScope } from "./types";
import styles from "./AiAssistantWidget.module.css";

const MAX_MESSAGE_LENGTH = 3_000;
const REQUEST_TIMEOUT_MS = 65_000;
const PANEL_ID = "uth-ai-assistant-panel";
const TYPEWRITER_DELAY_MS = 42;
const SENTENCE_PAUSE_MS = 450;
const SPEECH_AUTO_HIDE_MS = 12_000;
const WELCOME_AUTO_HIDE_MS = 60_000;
const NUDGE_MIN_DELAY_MS = 7 * 60 * 1_000;
const NUDGE_MAX_DELAY_MS = 10 * 60 * 1_000;
const NUDGE_RETRY_DELAY_MS = 60 * 1_000;
const NEXT_NUDGE_AT_KEY = "uth-ai-assistant-next-nudge-at";
const LAST_NUDGE_INDEX_KEY = "uth-ai-assistant-last-nudge-index";

const quickQuestionKeys = [
  "aiAssistantQuestionSubmit",
  "aiAssistantQuestionResults",
  "aiAssistantQuestionContest",
  "aiAssistantQuestionLeaderboard",
] as const;

const proactiveMessageKeys = [
  "aiAssistantNudge1",
  "aiAssistantNudge2",
  "aiAssistantNudge3",
  "aiAssistantNudge4",
  "aiAssistantNudge5",
  "aiAssistantNudge6",
  "aiAssistantNudge7",
] as const;

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  scope?: AiAssistantScope;
};

type AssistantSpeech = {
  id: number;
  kind: "welcome" | "nudge";
  sentences: string[];
};

function getVietnameseGreetingPeriod(): "Morning" | "Afternoon" | "Evening" {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart ?? "0");

  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Afternoon";
  return "Evening";
}

function isTaskRoute(pathname: string): boolean {
  return (
    /^\/problems\/[^/]+(?:\/|$)/.test(pathname) ||
    /^\/contests\/[^/]+(?:\/|$)/.test(pathname) ||
    /^\/organizations\/[^/]+\/(?:problems|contests)(?:\/|$)/.test(pathname)
  );
}

function isTextEntryFocused(): boolean {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return false;

  return (
    activeElement.matches(
      'input, textarea, select, [role="textbox"], [contenteditable="true"]',
    ) ||
    activeElement.isContentEditable ||
    Boolean(activeElement.closest(".monaco-editor"))
  );
}

function subscribeToReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getReducedMotionPreference() {
  return (
    typeof window !== "undefined" &&
    Boolean(
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    )
  );
}

function getErrorKey(error: unknown, didTimeout: boolean): string {
  if (didTimeout) return "aiAssistantErrorTimeout";
  if (error instanceof InvalidAiAssistantResponseError) {
    return "aiAssistantErrorInvalidResponse";
  }
  if (error instanceof ApiError) {
    if (error.status === 400) return "aiAssistantErrorBadRequest";
    if (error.status === 401) return "aiAssistantErrorUnauthorized";
    if (error.status === 429) {
      switch (error.code) {
        case "RATE_LIMIT_MINUTE":
          return "aiAssistantErrorRateLimitMinute";
        case "RATE_LIMIT_HOUR":
          return "aiAssistantErrorRateLimitHour";
        case "CONCURRENT_REQUEST":
          return "aiAssistantErrorConcurrentRequest";
        case "IP_RATE_LIMIT":
          return "aiAssistantErrorIpRateLimit";
        case "GLOBAL_RATE_LIMIT":
          return "aiAssistantErrorGlobalRateLimit";
        case "PROVIDER_CONCURRENCY":
          return "aiAssistantErrorProviderConcurrency";
        case "PROVIDER_DAILY_QUOTA":
          return "aiAssistantErrorProviderDailyQuota";
        default:
          return "aiAssistantErrorRateLimit";
      }
    }
    if (error.status === 503) return "aiAssistantErrorUnavailable";
    if (error.status === 0) return "aiAssistantErrorNetwork";
  }
  return "aiAssistantErrorGeneric";
}

function renderAnswer(answer: string) {
  return answer.split(/\r?\n/).map((line, index) => {
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      return (
        <p className={styles.answerBullet} key={index}>
          <span aria-hidden="true">•</span>
          <span>{bullet[1]}</span>
        </p>
      );
    }

    return line ? (
      <p className={styles.answerParagraph} key={index}>
        {line}
      </p>
    ) : (
      <div aria-hidden="true" className={styles.answerBreak} key={index} />
    );
  });
}

export function AiAssistantWidget() {
  const { t } = useTranslation("common");
  const { accessToken, isAuthenticated, isLoading, request, user } = useAuth();
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [speech, setSpeech] = useState<AssistantSpeech | null>(null);
  const [speechOutput, setSpeechOutput] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    () => false,
  );
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationContext, setConversationContext] = useState<string | null>(
    null,
  );
  const [isSending, setIsSending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorRetryAfterSeconds, setErrorRetryAfterSeconds] = useState<
    number | null
  >(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const nextMessageIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);
  const currentUserIdRef = useRef(user?.id ?? null);
  const nextSpeechIdRef = useRef(0);
  const typewriterTimerRef = useRef<number | null>(null);
  const autoHideTimerRef = useRef<number | null>(null);
  const welcomeTimerRef = useRef<number | null>(null);
  const welcomeDeadlineRef = useRef<number | null>(null);
  const nudgeTimerRef = useRef<number | null>(null);
  const nextNudgeAtRef = useRef<number | null>(null);
  const speechRef = useRef(speech);
  const previousPathnameRef = useRef(pathname);
  const pendingWelcomeRef = useRef(true);
  const isOpenRef = useRef(isOpen);
  const pathnameRef = useRef(pathname);
  const translateRef = useRef(t);
  const armNudgeTimerRef = useRef<() => void>(() => {});
  const scheduleNextNudgeRef = useRef<() => void>(() => {});
  const dismissSpeechRef = useRef<() => void>(() => {});
  const userId = user?.id ?? null;
  const isNearLimit = draft.length >= MAX_MESSAGE_LENGTH - 300;
  const speechText =
    speech === null
      ? ""
      : reducedMotion
        ? speech.sentences.join(" ")
        : speechOutput !== null && speechOutput.id === speech.id
          ? speechOutput.text
          : "";

  const clearNudgeTimer = useCallback(() => {
    if (nudgeTimerRef.current !== null) {
      window.clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }, []);

  const clearSpeechTimers = useCallback(() => {
    if (typewriterTimerRef.current !== null) {
      window.clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    if (welcomeTimerRef.current !== null) {
      window.clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    }
    welcomeDeadlineRef.current = null;
  }, []);

  const isNudgeEligible = useCallback(() => {
    return (
      document.visibilityState === "visible" &&
      !isOpenRef.current &&
      !speechRef.current &&
      !isTaskRoute(pathnameRef.current) &&
      !isTextEntryFocused()
    );
  }, []);

  const storeNextNudgeAt = useCallback((timestamp: number) => {
    nextNudgeAtRef.current = timestamp;
    window.sessionStorage.setItem(NEXT_NUDGE_AT_KEY, String(timestamp));
  }, []);

  const armNudgeTimer = useCallback(() => {
    clearNudgeTimer();
    if (!isNudgeEligible()) return;

    let nextNudgeAt = nextNudgeAtRef.current;
    if (nextNudgeAt === null) {
      const savedTimestamp = Number(
        window.sessionStorage.getItem(NEXT_NUDGE_AT_KEY),
      );
      nextNudgeAt =
        Number.isFinite(savedTimestamp) && savedTimestamp > 0
          ? savedTimestamp
          : Date.now() +
            NUDGE_MIN_DELAY_MS +
            Math.floor(
              Math.random() *
                (NUDGE_MAX_DELAY_MS - NUDGE_MIN_DELAY_MS + 1),
            );
      storeNextNudgeAt(nextNudgeAt);
    }

    if (nextNudgeAt <= Date.now()) {
      nextNudgeAt = Date.now() + NUDGE_RETRY_DELAY_MS;
      storeNextNudgeAt(nextNudgeAt);
    }

    nudgeTimerRef.current = window.setTimeout(() => {
      nudgeTimerRef.current = null;
      if (!isNudgeEligible()) {
        if (
          document.visibilityState === "visible" &&
          !isOpenRef.current &&
          !speechRef.current &&
          !isTaskRoute(pathnameRef.current)
        ) {
          storeNextNudgeAt(Date.now() + NUDGE_RETRY_DELAY_MS);
          armNudgeTimerRef.current();
        }
        return;
      }

      const storedLastIndex = Number(
        window.sessionStorage.getItem(LAST_NUDGE_INDEX_KEY),
      );
      const lastIndex =
        Number.isInteger(storedLastIndex) &&
        storedLastIndex >= 0 &&
        storedLastIndex < proactiveMessageKeys.length
          ? storedLastIndex
          : null;
      const choices = proactiveMessageKeys
        .map((key, index) => ({ key, index }))
        .filter(({ index }) => index !== lastIndex);
      const choice =
        choices[
          Math.floor(Math.random() * choices.length)
        ] ?? choices[0];
      if (!choice) return;
      window.sessionStorage.setItem(
        LAST_NUDGE_INDEX_KEY,
        String(choice.index),
      );
      nextNudgeAtRef.current = null;
      window.sessionStorage.removeItem(NEXT_NUDGE_AT_KEY);
      setSpeech({
        id: nextSpeechIdRef.current++,
        kind: "nudge",
        sentences: [translateRef.current(choice.key)],
      });
    }, Math.max(0, nextNudgeAt - Date.now()));
  }, [clearNudgeTimer, isNudgeEligible, storeNextNudgeAt]);

  const scheduleNextNudge = useCallback(() => {
    const delay =
      NUDGE_MIN_DELAY_MS +
      Math.floor(
        Math.random() * (NUDGE_MAX_DELAY_MS - NUDGE_MIN_DELAY_MS + 1),
      );
    storeNextNudgeAt(Date.now() + delay);
    armNudgeTimer();
  }, [armNudgeTimer, storeNextNudgeAt]);

  const dismissSpeech = useCallback(() => {
    const hadSpeech = speechRef.current !== null;
    clearSpeechTimers();
    setSpeech(null);
    if (hadSpeech) scheduleNextNudgeRef.current();
  }, [clearSpeechTimers]);

  const startWelcome = useCallback(() => {
    clearNudgeTimer();
    clearSpeechTimers();
    setSpeechOutput(null);
    const username =
      isAuthenticated && user?.username?.trim()
        ? user.username.trim()
        : null;
    const period = getVietnameseGreetingPeriod();
    setSpeech({
      id: nextSpeechIdRef.current++,
      kind: "welcome",
      sentences: [
        translateRef.current(
          username
            ? `aiAssistantGreeting${period}`
            : `aiAssistantGreetingGuest${period}`,
          username ? { username } : undefined,
        ),
        translateRef.current("aiAssistantGreetingFollowup"),
      ],
    });
    welcomeDeadlineRef.current = Date.now() + WELCOME_AUTO_HIDE_MS;
  }, [clearNudgeTimer, clearSpeechTimers, isAuthenticated, user]);

  function openAssistant() {
    dismissSpeechRef.current();
    setIsOpen(true);
  }

  useLayoutEffect(() => {
    speechRef.current = speech;
    isOpenRef.current = isOpen;
    pathnameRef.current = pathname;
    translateRef.current = t;
    armNudgeTimerRef.current = armNudgeTimer;
    scheduleNextNudgeRef.current = scheduleNextNudge;
    dismissSpeechRef.current = dismissSpeech;
  }, [
    armNudgeTimer,
    dismissSpeech,
    isOpen,
    pathname,
    scheduleNextNudge,
    speech,
    t,
  ]);

  useLayoutEffect(() => {
    if (currentUserIdRef.current === userId) return;

    currentUserIdRef.current = userId;
    requestIdRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    isSendingRef.current = false;
    setMessages([]);
    setConversationContext(null);
    setDraft("");
    setErrorKey(null);
    setErrorRetryAfterSeconds(null);
    setInputError(null);
    setIsSending(false);
  }, [userId]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      requestControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const savedTimestamp = Number(
      window.sessionStorage.getItem(NEXT_NUDGE_AT_KEY),
    );
    if (Number.isFinite(savedTimestamp) && savedTimestamp > 0) {
      nextNudgeAtRef.current = savedTimestamp;
    } else {
      scheduleNextNudgeRef.current();
    }
    return clearNudgeTimer;
  }, [clearNudgeTimer]);

  useEffect(() => {
    if (speech || isOpen || isTaskRoute(pathname)) {
      clearNudgeTimer();
      return;
    }
    armNudgeTimerRef.current();
    return clearNudgeTimer;
  }, [clearNudgeTimer, isOpen, pathname, speech]);

  useEffect(() => {
    if (speech?.kind === "nudge" && isTaskRoute(pathname)) {
      dismissSpeechRef.current();
    }
  }, [pathname, speech]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    if (previousPathname !== pathname && pathname === "/") {
      pendingWelcomeRef.current = true;
    }
    if (!pendingWelcomeRef.current || isLoading) return;
    pendingWelcomeRef.current = false;
    // oxlint-disable-next-line react/set-state-in-effect -- Route changes start the next timed greeting.
    if (!isOpen) startWelcome();
  }, [isLoading, isOpen, pathname, startWelcome]);

  useEffect(() => {
    if (speech?.kind !== "welcome" || welcomeDeadlineRef.current === null) {
      return;
    }
    const deadline = welcomeDeadlineRef.current;
    const timer = window.setTimeout(() => {
      if (welcomeDeadlineRef.current !== deadline) return;
      welcomeTimerRef.current = null;
      dismissSpeechRef.current();
    }, Math.max(0, deadline - Date.now()));
    welcomeTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (welcomeTimerRef.current === timer) welcomeTimerRef.current = null;
    };
  }, [speech]);

  useEffect(() => {
    if (!speech || isOpen) return;
    if (reducedMotion) {
      if (speech.kind === "welcome") return;
      autoHideTimerRef.current = window.setTimeout(
        () => dismissSpeechRef.current(),
        SPEECH_AUTO_HIDE_MS,
      );
      return () => {
        if (autoHideTimerRef.current !== null) {
          window.clearTimeout(autoHideTimerRef.current);
          autoHideTimerRef.current = null;
        }
      };
    }

    const sentenceCharacters = speech.sentences.map((sentence) =>
      Array.from(sentence),
    );
    let sentenceIndex = 0;
    let characterIndex = 0;
    let cancelled = false;

    const typeNextCharacter = () => {
      if (cancelled) return;
      const currentSentence = sentenceCharacters[sentenceIndex];
      if (characterIndex < currentSentence.length) {
        const character = currentSentence[characterIndex++];
        setSpeechOutput((current) => ({
          id: speech.id,
          text: current?.id === speech.id ? current.text + character : character,
        }));
        typewriterTimerRef.current = window.setTimeout(
          typeNextCharacter,
          TYPEWRITER_DELAY_MS,
        );
        return;
      }

      if (sentenceIndex + 1 < sentenceCharacters.length) {
        typewriterTimerRef.current = window.setTimeout(() => {
          sentenceIndex += 1;
          characterIndex = 0;
          setSpeechOutput((current) => ({
            id: speech.id,
            text: current?.id === speech.id ? `${current.text} ` : " ",
          }));
          typeNextCharacter();
        }, SENTENCE_PAUSE_MS);
        return;
      }

      if (speech.kind === "nudge") {
        autoHideTimerRef.current = window.setTimeout(
          () => dismissSpeechRef.current(),
          SPEECH_AUTO_HIDE_MS,
        );
      }
    };

    typewriterTimerRef.current = window.setTimeout(
      typeNextCharacter,
      TYPEWRITER_DELAY_MS,
    );

    return () => {
      cancelled = true;
      if (typewriterTimerRef.current !== null) {
        window.clearTimeout(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
      if (autoHideTimerRef.current !== null) {
        window.clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, [isOpen, reducedMotion, speech]);

  useEffect(() => {
    const updateNudgeTimer = () => armNudgeTimerRef.current();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearNudgeTimer();
      else updateNudgeTimer();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("focusin", updateNudgeTimer);
    document.addEventListener("focusout", updateNudgeTimer);
    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      document.removeEventListener("focusin", updateNudgeTimer);
      document.removeEventListener("focusout", updateNudgeTimer);
    };
  }, [armNudgeTimer, clearNudgeTimer]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      launcherRef.current?.focus();
    }

    function closeOnOutsidePress(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !widgetRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [isOpen, messages, isSending]);

  async function sendMessage(rawMessage: string, clearDraft: boolean) {
    const message = rawMessage.trim();
    if (!message || isSendingRef.current) return;
    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      setInputError("aiAssistantErrorTooLong");
      return;
    }

    const requestId = ++requestIdRef.current;
    const requestUserId = userId;
    const sendRequest =
      isAuthenticated && user && accessToken ? request : publicRequest;
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    requestControllerRef.current = controller;
    isSendingRef.current = true;
    setIsSending(true);
    setErrorKey(null);
    setErrorRetryAfterSeconds(null);
    setInputError(null);
    setMessages((current) => [
      ...current,
      { id: nextMessageIdRef.current++, role: "user", text: message },
    ]);
    if (clearDraft) setDraft("");

    try {
      const response = await sendAiAssistantMessage(
        sendRequest,
        message,
        controller.signal,
        conversationContext,
      );
      if (
        requestId !== requestIdRef.current ||
        currentUserIdRef.current !== requestUserId
      ) {
        return;
      }
      setConversationContext(
        response.scope === "IN_SCOPE"
          ? (response.conversationContext ?? null)
          : null,
      );
      setMessages((current) => [
        ...current,
        {
          id: nextMessageIdRef.current++,
          role: "assistant",
          text: response.answer,
          scope: response.scope,
        },
      ]);
    } catch (error) {
      if (
        requestId !== requestIdRef.current ||
        (controller.signal.aborted && !didTimeout)
      ) {
        return;
      }
      setErrorKey(getErrorKey(error, didTimeout));
      setErrorRetryAfterSeconds(
        error instanceof ApiError && error.status === 429
          ? (error.retryAfterSeconds ?? null)
          : null,
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (requestId === requestIdRef.current) {
        requestControllerRef.current = null;
        isSendingRef.current = false;
        setIsSending(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft, true);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendMessage(draft, true);
    }
  }

  function clearChat() {
    setMessages([]);
    setConversationContext(null);
    setDraft("");
    setErrorKey(null);
    setErrorRetryAfterSeconds(null);
    setInputError(null);
  }

  return (
    <>
      <div className={styles.widget} ref={widgetRef}>
        <button
          aria-controls={PANEL_ID}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={t(isOpen ? "aiAssistantClose" : "aiAssistantOpen")}
          className={`${styles.launcher} ${isOpen ? styles.launcherOpen : ""}`}
          onClick={() => {
            if (isOpen) setIsOpen(false);
            else openAssistant();
          }}
          ref={launcherRef}
          title={t(isOpen ? "aiAssistantClose" : "aiAssistantOpen")}
          type="button"
        >
          <img alt="" className={styles.robotImage} src={assistantImage} />
        </button>
        {!isOpen && speech && (
          <button
            aria-controls={PANEL_ID}
            aria-expanded={false}
            aria-label={t("aiAssistantOpen")}
            className={styles.greetingBubble}
            data-testid="assistant-greeting-bubble"
            onClick={openAssistant}
            type="button"
          >
            <span aria-hidden="true" data-testid="assistant-greeting-text">
              {speechText}
            </span>
          </button>
        )}
      </div>

      {isOpen &&
        createPortal(
          <section
            aria-labelledby="uth-ai-assistant-title"
            aria-modal="false"
            className={styles.panel}
            id={PANEL_ID}
            ref={panelRef}
            role="dialog"
          >
            <header className={styles.header}>
              <div className={styles.headerIdentity}>
                <span aria-hidden="true" className={styles.headerIcon}>
                  <MessageCircle size={19} />
                </span>
                <div className={styles.headerText}>
                  <h2 id="uth-ai-assistant-title">{t("aiAssistantTitle")}</h2>
                  <p>{t("aiAssistantSubtitle")}</p>
                </div>
              </div>
              <div className={styles.headerActions}>
                {messages.length > 0 && (
                  <button
                    aria-label={t("aiAssistantClear")}
                    className={styles.iconButton}
                    disabled={isSending}
                    onClick={clearChat}
                    title={t("aiAssistantClear")}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                )}
                <button
                  aria-label={t("aiAssistantClose")}
                  className={styles.iconButton}
                  onClick={() => {
                    setIsOpen(false);
                    launcherRef.current?.focus();
                  }}
                  title={t("aiAssistantClose")}
                  type="button"
                >
                  <X aria-hidden="true" size={19} />
                </button>
              </div>
            </header>

            <div
              aria-label={t("aiAssistantConversation")}
              aria-live="polite"
              className={styles.messageList}
              ref={messageListRef}
              role="log"
            >
              {messages.length === 0 ? (
                <div className={styles.welcome}>
                  <p className={styles.welcomeMessage}>
                    {t("aiAssistantWelcome")}
                  </p>
                  <div
                    aria-label={t("aiAssistantQuickQuestions")}
                    className={styles.quickQuestions}
                  >
                    {quickQuestionKeys.map((key) => (
                      <button
                        className={styles.quickQuestion}
                        disabled={isSending}
                        key={key}
                        onClick={() => void sendMessage(t(key), false)}
                        type="button"
                      >
                        {t(key)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : styles.assistantRow}`}
                    data-scope={message.scope}
                    key={message.id}
                  >
                    <span className={styles.srOnly}>
                      {t(
                        message.role === "user"
                          ? "aiAssistantYou"
                          : "aiAssistantName",
                      )}
                    </span>
                    <div
                      className={`${styles.messageBubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}
                    >
                      {message.role === "assistant"
                        ? renderAnswer(message.text)
                        : message.text}
                    </div>
                  </div>
                ))
              )}
              {isSending && (
                <p aria-live="polite" className={styles.pending} role="status">
                  <span aria-hidden="true" className={styles.spinner} />
                  {t("aiAssistantPreparingAnswer")}
                </p>
              )}
              {errorKey && (
                <p className={styles.errorNotice} role="alert">
                  {errorRetryAfterSeconds
                    ? t(errorKey, { seconds: errorRetryAfterSeconds })
                    : t(errorKey)}
                </p>
              )}
            </div>

            <form className={styles.composer} onSubmit={handleSubmit}>
              <p className={styles.providerNotice}>
                {t("aiAssistantProviderNotice")}
              </p>
              <label className={styles.srOnly} htmlFor="uth-ai-assistant-input">
                {t("aiAssistantInputLabel")}
              </label>
              <textarea
                aria-describedby={
                  inputError
                    ? "uth-ai-assistant-input-error"
                    : isNearLimit
                      ? "uth-ai-assistant-character-count"
                      : undefined
                }
                className={styles.input}
                disabled={isSending}
                id="uth-ai-assistant-input"
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(event) => {
                  setDraft(event.currentTarget.value);
                  setInputError(null);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={t("aiAssistantPlaceholder")}
                ref={inputRef}
                rows={2}
                value={draft}
              />
              {inputError && (
                <span
                  className={styles.inputError}
                  id="uth-ai-assistant-input-error"
                  role="alert"
                >
                  {t(inputError)}
                </span>
              )}
              {isNearLimit && !inputError && (
                <span
                  className={styles.characterCount}
                  id="uth-ai-assistant-character-count"
                >
                  {t("aiAssistantCharacterCount", {
                    count: draft.length,
                    max: MAX_MESSAGE_LENGTH,
                  })}
                </span>
              )}
              <div className={styles.composerFooter}>
                <span className={styles.inputHint}>
                  {t("aiAssistantEnterHint")}
                </span>
                <button
                  aria-label={t("aiAssistantSend")}
                  className={styles.sendButton}
                  disabled={isSending || !draft.trim()}
                  type="submit"
                >
                  <Send aria-hidden="true" size={17} />
                  <span>{t("aiAssistantSend")}</span>
                </button>
              </div>
            </form>
          </section>,
          document.body,
        )}
    </>
  );
}
