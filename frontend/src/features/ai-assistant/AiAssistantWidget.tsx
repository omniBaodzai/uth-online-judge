import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import assistantImage from "../../assets/assistant.webp";
import { ApiError, request as publicRequest } from "../auth/api";
import { useAuth } from "../auth/useAuth";
import { InvalidAiAssistantResponseError, sendAiAssistantMessage } from "./api";
import type { AiAssistantScope } from "./types";
import styles from "./AiAssistantWidget.module.css";

const MAX_MESSAGE_LENGTH = 3_000;
const REQUEST_TIMEOUT_MS = 65_000;
const PANEL_ID = "uth-ai-assistant-panel";

const quickQuestionKeys = [
  "aiAssistantQuestionSubmit",
  "aiAssistantQuestionResults",
  "aiAssistantQuestionContest",
  "aiAssistantQuestionLeaderboard",
] as const;

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  scope?: AiAssistantScope;
};

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
  const { accessToken, isAuthenticated, request, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
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
  const userId = user?.id ?? null;
  const isNearLimit = draft.length >= MAX_MESSAGE_LENGTH - 300;

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
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      setShowGreeting(false);
      launcherRef.current?.focus();
    }

    function closeOnOutsidePress(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !widgetRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setShowGreeting(false);
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
            setShowGreeting(false);
            setIsOpen((open) => !open);
          }}
          ref={launcherRef}
          title={t(isOpen ? "aiAssistantClose" : "aiAssistantOpen")}
          type="button"
        >
          <img alt="" className={styles.robotImage} src={assistantImage} />
        </button>
        {!isOpen && showGreeting && (
          <span aria-hidden="true" className={styles.greetingBubble}>
            {t("aiAssistantGreetingBubble")}
          </span>
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
                    setShowGreeting(false);
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
