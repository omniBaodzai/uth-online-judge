// @vitest-environment happy-dom

import type { ReactNode } from "react";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import assistantImage from "../../assets/assistant.webp";
import FloatingActions from "../../components/floating/FloatingActions";
import { AiAssistantWidget } from "./AiAssistantWidget";
import i18n from "../../i18n";

const NUDGE_RETRY_DELAY_MS = 60 * 1_000;
const WELCOME_AUTO_HIDE_MS = 60 * 1_000;
const TYPEWRITER_DELAY_MS = 42;

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; username?: string | null },
  accessToken: null as string | null,
  isAuthenticated: false,
  isLoading: false,
  initializationError: null as string | null,
  request: vi.fn(),
  publicRequest: vi.fn(),
}));

vi.mock("../auth/useAuth", () => ({
  useAuth: () => mocks,
}));

vi.mock("../auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/api")>();
  return { ...actual, request: mocks.publicRequest };
});

vi.mock("../../components/floating/ScrollControls", () => ({
  default: () => <button type="button">Scroll control</button>,
}));

let root: Root;
let container: HTMLDivElement;

function RouteTestControls() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" data-testid="go-home" onClick={() => navigate("/")}>
        Go home
      </button>
      <button
        type="button"
        data-testid="go-task"
        onClick={() => navigate("/problems/UTH101/submit")}
      >
        Go to task
      </button>
      <button
        type="button"
        data-testid="go-news"
        onClick={() => navigate("/news")}
      >
        Go to news
      </button>
    </>
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("vi");
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mocks.user = null;
  mocks.accessToken = null;
  mocks.isAuthenticated = false;
  mocks.isLoading = false;
  mocks.initializationError = null;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  mocks.request.mockResolvedValue({
    scope: "IN_SCOPE",
    answer: "Mở /problems để xem bài tập.",
  });
  mocks.publicRequest.mockResolvedValue({
    scope: "IN_SCOPE",
    answer: "Mở /problems để xem bài tập.",
  });
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  vi.useRealTimers();
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(
  element: ReactNode = <AiAssistantWidget />,
  options: {
    initialPath?: string;
    includeRouteControls?: boolean;
    includeInput?: boolean;
    strictMode?: boolean;
  } = {},
) {
  const tree = (
    <MemoryRouter initialEntries={[options.initialPath ?? "/problems"]}>
      {element}
      {options.includeRouteControls && <RouteTestControls />}
      {options.includeInput && <input aria-label="Page input" />}
    </MemoryRouter>
  );
  await act(async () => {
    root.render(options.strictMode ? <StrictMode>{tree}</StrictMode> : tree);
  });
}

async function advanceTime(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

async function finishSpeech() {
  await advanceTime(5_000);
  return (
    container.querySelector('[data-testid="assistant-greeting-text"]')
      ?.textContent ?? ""
  );
}

function buttonByLabel(label: string): HTMLButtonElement | null {
  return (
    [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.getAttribute("aria-label") === label,
    ) ?? null
  );
}

function buttonByText(text: string): HTMLButtonElement | null {
  return (
    [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === text,
    ) ?? null
  );
}

async function openWidget() {
  const launcher = buttonByLabel("Mở UTH AI Assistant");
  expect(launcher).not.toBeNull();
  await act(async () => launcher?.click());
  return launcher;
}

async function dismissGreeting() {
  const greeting = container.querySelector<HTMLButtonElement>(
    '[data-testid="assistant-greeting-bubble"]',
  );
  if (!greeting) return;
  await act(async () => greeting.click());
  await act(async () => buttonByLabel("Đóng UTH AI Assistant")?.click());
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function authenticate(id = "user-1", username: string | null = "student") {
  mocks.user = { id, username };
  mocks.accessToken = "test-access-token";
  mocks.isAuthenticated = true;
}

describe("AiAssistantWidget", () => {
  it("renders the provided robot launcher and keeps scroll controls without a floating contact button", async () => {
    await render(<FloatingActions />);

    const dock = container.firstElementChild;
    expect(dock?.children).toHaveLength(2);
    const launcher = dock?.querySelector<HTMLButtonElement>(
      '[aria-label="Mở UTH AI Assistant"]',
    );
    expect(launcher).not.toBeNull();
    expect(launcher?.querySelector("img")?.getAttribute("src")).toBe(
      assistantImage,
    );
    expect(launcher?.title).toBe("Mở UTH AI Assistant");
    expect(dock?.textContent).not.toContain("Liên hệ");
    expect(dock?.children[1]?.textContent).toContain("Scroll control");
  });

  it("opens and closes the panel from the robot launcher", async () => {
    await render();
    const launcher = await openWidget();

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => launcher?.click());
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens the panel, displays the welcome message, and focuses the input", async () => {
    await render();
    await openWidget();

    expect(document.body.textContent).toContain(
      "Xin chào! Mình là UTH AI Assistant.",
    );
    expect(document.body.textContent).toContain(
      "Câu hỏi có thể được xử lý bởi dịch vụ AI bên ngoài.",
    );
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(
      document.body.querySelector("#uth-ai-assistant-input"),
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("discloses external AI processing in English", async () => {
    await render();
    await openWidget();
    await act(async () => i18n.changeLanguage("en"));

    expect(document.body.textContent).toContain(
      "Your question may be processed by an external AI service.",
    );
  });

  it("closes on Escape and returns focus to the launcher", async () => {
    await render();
    const launcher = await openWidget();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });

  it("keeps portal interactions inside the panel and closes on outside press", async () => {
    await render();
    await openWidget();
    const textarea = document.body.querySelector("textarea");
    if (!textarea) throw new Error("Chat input was not rendered.");

    await act(async () => {
      textarea.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("lets a guest send a quick question without requiring sign-in", async () => {
    await render();
    await openWidget();

    expect(document.body.textContent).not.toContain("Đăng nhập để gửi câu hỏi");
    const quickQuestion = buttonByText("Làm sao để nộp bài?");
    expect(quickQuestion?.disabled).toBe(false);
    await act(async () => quickQuestion?.click());
    expect(mocks.publicRequest).toHaveBeenCalledOnce();
    expect(mocks.request).not.toHaveBeenCalled();
    const [path, init] = mocks.publicRequest.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(path).toBe("/ai-assistant/chat");
    expect(JSON.parse(String(init.body))).toEqual({
      message: "Làm sao để nộp bài?",
    });
    expect(init.headers).toBeUndefined();
  });

  it("allows guest use while auth restoration is still in progress", async () => {
    mocks.isLoading = true;
    await render();
    await openWidget();

    expect(document.body.textContent).not.toContain("Đăng nhập để gửi câu hỏi");
    await act(async () => buttonByText("Làm sao để nộp bài?")?.click());
    expect(mocks.publicRequest).toHaveBeenCalledOnce();
  });

  it("allows guest use if the existing auth session could not be restored", async () => {
    mocks.initializationError = "private auth error";
    await render();
    await openWidget();

    expect(document.body.textContent).not.toContain("private auth error");
    await act(async () => buttonByText("Làm sao để nộp bài?")?.click());
    expect(mocks.publicRequest).toHaveBeenCalledOnce();
  });

  it("sends only the trimmed message through the authenticated request helper", async () => {
    authenticate();
    await render();
    await openWidget();
    const textarea =
      document.body.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Chat input was not rendered.");

    await act(async () => {
      setTextareaValue(textarea, "  Làm sao để nộp bài?  ");
    });
    await act(async () => buttonByLabel("Gửi")?.click());

    expect(mocks.request).toHaveBeenCalledOnce();
    const [path, init] = mocks.request.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/ai-assistant/chat");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ message: "Làm sao để nộp bài?" }),
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(JSON.parse(String(init.body)))).toEqual(["message"]);
    expect(document.body.textContent).toContain("Mở /problems để xem bài tập.");
  });

  it("sends only the signed context for follow-ups and clears it with the chat", async () => {
    authenticate();
    mocks.request
      .mockResolvedValueOnce({
        scope: "IN_SCOPE",
        answer: "Mở /problems để xem bài tập.",
        conversationContext: "signed-context-token",
      })
      .mockResolvedValueOnce({
        scope: "IN_SCOPE",
        answer: "Xem kết quả chấm trong lịch sử bài nộp.",
        conversationContext: "next-signed-context-token",
      });
    await render();
    await openWidget();

    await act(async () => buttonByText("Làm sao để nộp bài?")?.click());
    const textarea =
      document.body.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Chat input was not rendered.");
    await act(async () => {
      setTextareaValue(textarea, "Nếu bị sai thì sao?");
      buttonByLabel("Gửi")?.click();
    });

    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(mocks.request.mock.calls[1]?.[1]?.body))).toEqual({
      message: "Nếu bị sai thì sao?",
      conversationContext: "signed-context-token",
    });

    await act(async () => buttonByLabel("Xóa cuộc trò chuyện")?.click());
    await act(async () => buttonByText("Làm sao để nộp bài?")?.click());
    expect(JSON.parse(String(mocks.request.mock.calls[2]?.[1]?.body))).toEqual({
      message: "Làm sao để nộp bài?",
    });
  });

  it("sends the selected FAQ-matched quick question", async () => {
    authenticate();
    await render();
    await openWidget();

    await act(async () => buttonByText("Xem kết quả chấm ở đâu?")?.click());

    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.request.mock.calls[0]?.[0]).toBe("/ai-assistant/chat");
    expect(JSON.parse(String(mocks.request.mock.calls[0]?.[1]?.body))).toEqual({
      message: "Xem kết quả chấm ở đâu?",
    });
  });

  it("does not send an empty or whitespace-only draft", async () => {
    authenticate();
    await render();
    await openWidget();
    const textarea =
      document.body.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Chat input was not rendered.");

    await act(async () => {
      setTextareaValue(textarea, "   ");
      buttonByLabel("Gửi")?.click();
    });

    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("enforces the 3,000 character limit before sending", async () => {
    authenticate();
    await render();
    await openWidget();
    const textarea =
      document.body.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Chat input was not rendered.");

    await act(async () => setTextareaValue(textarea, "a".repeat(3_001)));
    const form = textarea.closest("form");
    if (!form) throw new Error("Chat form was not rendered.");
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(textarea.maxLength).toBe(3_000);
    expect(document.body.textContent).toContain(
      "không được vượt quá 3.000 ký tự",
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("sends on Enter but leaves Shift+Enter available for a new line", async () => {
    authenticate();
    await render();
    await openWidget();
    const textarea =
      document.body.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Chat input was not rendered.");
    await act(async () => setTextareaValue(textarea, "Câu hỏi"));

    const newline = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => textarea.dispatchEvent(newline));
    expect(newline.defaultPrevented).toBe(false);
    expect(mocks.request).not.toHaveBeenCalled();

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(mocks.request).toHaveBeenCalledOnce();
  });

  it("shows loading and prevents duplicate submits while a request is pending", async () => {
    authenticate();
    let resolveRequest: ((value: unknown) => void) | undefined;
    mocks.request.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    await render();
    await openWidget();
    const textarea =
      document.body.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Chat input was not rendered.");
    await act(async () => setTextareaValue(textarea, "Câu hỏi"));

    await act(async () => {
      buttonByLabel("Gửi")?.click();
      buttonByLabel("Gửi")?.click();
    });

    expect(document.body.textContent).toContain("Đang chuẩn bị câu trả lời");
    expect(mocks.request).toHaveBeenCalledOnce();
    await act(async () => {
      resolveRequest?.({ scope: "IN_SCOPE", answer: "Đã xong." });
    });
    expect(document.body.textContent).toContain("Đã xong.");
  });

  it.each(["IN_SCOPE", "OUT_OF_SCOPE", "UNCERTAIN"] as const)(
    "renders the %s scope as a normal assistant response",
    async (scope) => {
      authenticate();
      mocks.request.mockResolvedValue({ scope, answer: `Answer ${scope}` });
      await render();
      await openWidget();
      await act(async () => buttonByText("Làm sao để nộp bài?")?.click());

      expect(
        document.body.querySelector(`[data-scope="${scope}"]`)?.textContent,
      ).toContain(`Answer ${scope}`);
      expect(document.body.querySelector('[role="alert"]')).toBeNull();
    },
  );

  it("renders provider answers as text rather than HTML", async () => {
    authenticate();
    mocks.request.mockResolvedValue({
      scope: "IN_SCOPE",
      answer: "<img src=x onerror=alert(1)>",
    });
    await render();
    await openWidget();
    await act(async () => buttonByText("Làm sao để nộp bài?")?.click());

    expect(
      document.body.querySelector('[data-scope="IN_SCOPE"] img'),
    ).toBeNull();
    expect(document.body.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it.each([
    null,
    {},
    { scope: "OTHER", answer: "bad scope" },
    { scope: "IN_SCOPE", answer: "" },
    { scope: "IN_SCOPE" },
  ])(
    "rejects a malformed API response without rendering it",
    async (response) => {
      authenticate();
      mocks.request.mockResolvedValue(response);
      await render();
      await openWidget();
      await act(async () => buttonByText("Làm sao để nộp bài?")?.click());

      expect(document.body.textContent).toContain("phản hồi không hợp lệ");
      expect(document.body.textContent).not.toContain("bad scope");
    },
  );

  it.each([
    [400, "Câu hỏi chưa hợp lệ"],
    [401, "Phiên đăng nhập đã hết hạn"],
    [503, "tạm thời không khả dụng"],
    [0, "Không thể kết nối máy chủ"],
  ])(
    "maps HTTP/network status %i to localized safe text",
    async (status, copy) => {
      authenticate();
      mocks.request.mockRejectedValue(
        new ApiError("private provider details", status),
      );
      await render();
      await openWidget();
      const textarea =
        document.body.querySelector<HTMLTextAreaElement>("textarea");
      if (!textarea) throw new Error("Chat input was not rendered.");
      await act(async () => setTextareaValue(textarea, "A question"));
      await act(async () => buttonByLabel("Gửi")?.click());

      expect(document.body.textContent).toContain(copy);
      expect(document.body.textContent).not.toContain(
        "private provider details",
      );
    },
  );

  it.each([
    ["RATE_LIMIT_MINUTE", "giới hạn câu hỏi trong phút này"],
    ["RATE_LIMIT_HOUR", "giới hạn câu hỏi trong giờ này"],
    ["CONCURRENT_REQUEST", "Yêu cầu trước của bạn vẫn đang được xử lý"],
    ["IP_RATE_LIMIT", "Lưu lượng từ mạng này"],
    ["GLOBAL_RATE_LIMIT", "đang nhận nhiều yêu cầu"],
    ["PROVIDER_CONCURRENCY", "đang xử lý tối đa số yêu cầu cùng lúc"],
    ["PROVIDER_DAILY_QUOTA", "giới hạn sử dụng trong ngày"],
  ])(
    "shows a localized reason and retry delay for 429 code %s",
    async (code, copy) => {
      authenticate();
      mocks.request.mockRejectedValue(
        new ApiError("private limiter details", 429, undefined, 37, code),
      );
      await render();
      await openWidget();
      const textarea =
        document.body.querySelector<HTMLTextAreaElement>("textarea");
      if (!textarea) throw new Error("Chat input was not rendered.");
      await act(async () => setTextareaValue(textarea, "A question"));
      await act(async () => buttonByLabel("Gửi")?.click());

      expect(document.body.textContent).toContain(copy);
      expect(document.body.textContent).toContain("37 giây");
      expect(document.body.textContent).not.toContain(
        "private limiter details",
      );
      expect(mocks.request).toHaveBeenCalledOnce();
    },
  );

  it("shows a timeout message when the request exceeds its deadline", async () => {
    authenticate();
    mocks.request.mockImplementation(
      (_path: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new ApiError("aborted", 0)),
            { once: true },
          );
        }),
    );
    vi.useFakeTimers();
    await render();
    await openWidget();
    const textarea =
      document.body.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Chat input was not rendered.");
    await act(async () => setTextareaValue(textarea, "A question"));
    await act(async () => buttonByLabel("Gửi")?.click());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
    });

    expect(document.body.textContent).toContain(
      "Yêu cầu mất quá nhiều thời gian",
    );
  });

  it("clears only local conversation state", async () => {
    authenticate();
    await render();
    await openWidget();
    await act(async () => buttonByText("Làm sao để nộp bài?")?.click());
    expect(document.body.textContent).toContain("Mở /problems để xem bài tập.");

    await act(async () => buttonByLabel("Xóa cuộc trò chuyện")?.click());

    expect(document.body.textContent).toContain(
      "Xin chào! Mình là UTH AI Assistant.",
    );
    expect(document.body.textContent).not.toContain(
      "Mở /problems để xem bài tập.",
    );
    expect(mocks.request).toHaveBeenCalledOnce();
  });

  it("clears history when logging out or switching accounts", async () => {
    authenticate("user-1");
    await render();
    await openWidget();
    await act(async () => buttonByText("Làm sao để nộp bài?")?.click());
    expect(document.body.textContent).toContain("Mở /problems để xem bài tập.");

    mocks.user = { id: "user-2" };
    await render();
    expect(document.body.textContent).not.toContain(
      "Mở /problems để xem bài tập.",
    );
    expect(document.body.textContent).toContain("Làm sao để nộp bài?");

    mocks.user = null;
    mocks.accessToken = null;
    mocks.isAuthenticated = false;
    await render();
    expect(document.body.textContent).not.toContain("Đăng nhập để gửi câu hỏi");
    expect(document.body.textContent).not.toContain(
      "Mở /problems để xem bài tập.",
    );
  });

  it("updates localized UI when the language changes", async () => {
    await render();
    await openWidget();
    expect(document.body.textContent).toContain(
      "Xin chào! Mình là UTH AI Assistant.",
    );

    await act(async () => i18n.changeLanguage("en"));

    expect(document.body.textContent).toContain("Hello! I’m UTH AI Assistant.");
    expect(buttonByText("How do I submit a solution?")).not.toBeNull();
  });

  it("continues to render with the current root theme and styles from shared tokens", async () => {
    await render();
    await openWidget();
    document.documentElement.dataset.theme = "dark";

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    delete document.documentElement.dataset.theme;
  });

  it.each([
    ["04:59", "2026-01-01T21:59:00.000Z", "Chào buổi tối, bạn nhé!"],
    ["05:00", "2026-01-01T22:00:00.000Z", "Chào buổi sáng, bạn nhé!"],
    ["11:59", "2026-01-01T04:59:00.000Z", "Chào buổi sáng, bạn nhé!"],
    ["12:00", "2026-01-01T05:00:00.000Z", "Chào buổi chiều, bạn nhé!"],
    ["17:59", "2026-01-01T10:59:00.000Z", "Chào buổi chiều, bạn nhé!"],
    ["18:00", "2026-01-01T11:00:00.000Z", "Chào buổi tối, bạn nhé!"],
  ])("uses Vietnam local time at %s", async (_label, utcTime, greeting) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(utcTime));
    await render(<AiAssistantWidget />, { initialPath: "/" });

    expect(await finishSpeech()).toContain(greeting);
  });

  it("greets an authenticated user by username and uses a generic greeting for guests or null usernames", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T22:00:00.000Z"));
    authenticate("user-1", "lan");
    await render(<AiAssistantWidget />, { initialPath: "/" });
    expect(await finishSpeech()).toContain("Chào buổi sáng, lan!");

    await act(async () => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    mocks.user = null;
    mocks.isAuthenticated = false;
    window.sessionStorage.clear();
    await render(<AiAssistantWidget />, { initialPath: "/" });
    expect(await finishSpeech()).toContain("Chào buổi sáng, bạn nhé!");

    await act(async () => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    authenticate("user-2", null);
    window.sessionStorage.clear();
    await render(<AiAssistantWidget />, { initialPath: "/" });
    expect(await finishSpeech()).toContain("Chào buổi sáng, bạn nhé!");
  });

  it("waits for AuthContext session restoration before showing a personalized greeting", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T22:00:00.000Z"));
    mocks.isLoading = true;
    authenticate("user-1", "linh");
    await render(<AiAssistantWidget />, { initialPath: "/" });
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();

    mocks.isLoading = false;
    await render(<AiAssistantWidget />, { initialPath: "/" });
    expect(await finishSpeech()).toContain("Chào buổi sáng, linh!");
  });

  it("types each sentence in order with a 450ms pause and does not call the AI API", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T22:00:00.000Z"));
    authenticate("user-1", "An");
    await render(<AiAssistantWidget />, { initialPath: "/" });

    const text = () =>
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent ?? "";
    expect(text()).toBe("");
    await advanceTime(42);
    expect(text()).toBe("C");

    const firstSentence = "Chào buổi sáng, An!";
    await advanceTime((firstSentence.length - 1) * 42);
    expect(text()).toBe(firstSentence);
    await advanceTime(42);
    await advanceTime(449);
    expect(text()).toBe(firstSentence);
    await advanceTime(1);
    expect(text()).toMatch(/^Chào buổi sáng, An! M/);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.publicRequest).not.toHaveBeenCalled();
  });

  it("opens the assistant from the greeting button without sending a question", async () => {
    vi.useFakeTimers();
    await render(<AiAssistantWidget />, { initialPath: "/" });

    const greetingBubble = container.querySelector<HTMLButtonElement>(
      '[data-testid="assistant-greeting-bubble"]',
    );
    expect(greetingBubble?.tagName).toBe("BUTTON");
    await act(async () => greetingBubble?.click());

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.publicRequest).not.toHaveBeenCalled();
  });

  it("replays the initial greeting after a reload on any route, ignoring the legacy session flag", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T22:00:00.000Z"));
    window.sessionStorage.setItem("uth-ai-assistant-welcome-shown", "1");
    await render(<AiAssistantWidget />, {
      initialPath: "/problems",
    });
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    await advanceTime(TYPEWRITER_DELAY_MS);
    expect(
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent,
    ).toBe("C");

    await act(async () => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await render(<AiAssistantWidget />, { initialPath: "/problems" });
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent,
    ).toBe("");
    await advanceTime(TYPEWRITER_DELAY_MS);
    expect(
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent,
    ).toBe("C");
  });

  it("keeps the original deadline and typewriter state while navigating away from home", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T22:00:00.000Z"));
    await render(<AiAssistantWidget />, {
      initialPath: "/",
      includeRouteControls: true,
    });
    await advanceTime(20_000);
    const textBeforeNavigation =
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent;
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-testid="go-task"]')?.click(),
    );
    expect(
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent,
    ).toBe(textBeforeNavigation);

    await advanceTime(39_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    await advanceTime(1_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
  });

  it("restarts the greeting for a real return to home and resets its 60-second deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T22:00:00.000Z"));
    await render(<AiAssistantWidget />, {
      initialPath: "/problems",
      includeRouteControls: true,
    });
    await advanceTime(WELCOME_AUTO_HIDE_MS);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-testid="go-home"]')?.click(),
    );
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent,
    ).toBe("");
    await advanceTime(TYPEWRITER_DELAY_MS);
    expect(
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent,
    ).toBe("C");

    await advanceTime(WELCOME_AUTO_HIDE_MS - TYPEWRITER_DELAY_MS - 1);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    await advanceTime(1);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
  });

  it("does not reset the welcome deadline on rerender or AuthContext updates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T22:00:00.000Z"));
    authenticate("user-1", "lan");
    await render(<AiAssistantWidget />, { initialPath: "/problems" });
    await advanceTime(20_000);
    authenticate("user-1", "lan-updated");
    await render(<AiAssistantWidget />, { initialPath: "/problems" });
    await advanceTime(39_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    await advanceTime(1_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
  });

  it.each([0, 0.99999])(
    "shows a proactive message after a randomized delay within range",
    async (randomValue) => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(randomValue);
    await render(<AiAssistantWidget />, { initialPath: "/news" });
    await dismissGreeting();
    const remainingDelay =
      Number(window.sessionStorage.getItem("uth-ai-assistant-next-nudge-at")) -
      Date.now();
    expect(remainingDelay).toBeGreaterThanOrEqual(7 * 60 * 1_000);
    expect(remainingDelay).toBeLessThanOrEqual(10 * 60 * 1_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();

    await advanceTime(remainingDelay - 1);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
    await advanceTime(1);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    },
  );

  it("does not repeat the same proactive message consecutively and waits before the next one", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    await render(<AiAssistantWidget />, { initialPath: "/news" });
    await dismissGreeting();
    await advanceTime(7 * 60 * 1_000);
    const firstMessage = await finishSpeech();
    expect(firstMessage).not.toBe("");

    await act(async () => {
      container.querySelector<HTMLButtonElement>(
        '[data-testid="assistant-greeting-bubble"]',
      )?.click();
    });
    await act(async () => buttonByLabel("Đóng UTH AI Assistant")?.click());
    await advanceTime(7 * 60 * 1_000);
    const secondMessage = await finishSpeech();
    expect(secondMessage).not.toBe(firstMessage);
  });

  it("pauses proactive messages while the chatbot is open and the tab is hidden", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    await render(<AiAssistantWidget />, { initialPath: "/news" });
    await openWidget();
    await advanceTime(10 * 60 * 1_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
    await act(async () => buttonByLabel("Đóng UTH AI Assistant")?.click());
    await advanceTime(NUDGE_RETRY_DELAY_MS - 1);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
    await advanceTime(1);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>(
        '[data-testid="assistant-greeting-bubble"]',
      )?.click();
    });
    await act(async () => buttonByLabel("Đóng UTH AI Assistant")?.click());
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await advanceTime(10 * 60 * 1_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await advanceTime(NUDGE_RETRY_DELAY_MS);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
  });

  it("defers proactive messages on task routes and while a text editor is focused", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    await render(<AiAssistantWidget />, {
      initialPath: "/problems/UTH101/submit",
      includeRouteControls: true,
      includeInput: true,
    });
    await advanceTime(10 * 60 * 1_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="go-news"]')?.click());
    await advanceTime(NUDGE_RETRY_DELAY_MS);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>(
        '[data-testid="assistant-greeting-bubble"]',
      )?.click();
    });
    await act(async () => {
      buttonByLabel("Đóng UTH AI Assistant")?.click();
      container.querySelector<HTMLInputElement>('[aria-label="Page input"]')?.focus();
    });
    await advanceTime(10 * 60 * 1_000);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
    await act(async () =>
      container.querySelector<HTMLInputElement>('[aria-label="Page input"]')?.blur(),
    );
    await advanceTime(NUDGE_RETRY_DELAY_MS);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
  });

  it("shows all speech immediately with reduced motion and cleans up timers on unmount", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T22:00:00.000Z"));
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    vi.spyOn(window, "matchMedia").mockReturnValue(mediaQuery);
    Object.defineProperty(mediaQuery, "matches", {
      configurable: true,
      value: true,
    });
    await render(<AiAssistantWidget />, {
      initialPath: "/",
      strictMode: true,
    });
    expect(
      container.querySelector('[data-testid="assistant-greeting-text"]')
        ?.textContent,
    ).toBe("Chào buổi sáng, bạn nhé! Mình có thể giúp gì cho bạn?");
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.publicRequest).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("auto-hides the welcome speech after 60 seconds and keeps the mobile greeting control available", async () => {
    vi.useFakeTimers();
    await render(<AiAssistantWidget />, { initialPath: "/" });
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    await advanceTime(WELCOME_AUTO_HIDE_MS - 1);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).not.toBeNull();
    await advanceTime(1);
    expect(
      container.querySelector('[data-testid="assistant-greeting-bubble"]'),
    ).toBeNull();
  });
});
