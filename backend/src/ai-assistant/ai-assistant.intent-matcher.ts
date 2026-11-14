import { AI_ASSISTANT_FAQ } from './ai-assistant.knowledge.js';
import type {
  AiAssistantFaqEntry,
  AiAssistantFaqId,
  AiAssistantLanguage,
} from './ai-assistant.types.js';

export type AiAssistantBasicIntent =
  'GREETING' | 'THANKS' | 'GOODBYE' | 'CAPABILITIES' | 'BOT_IDENTITY';

type LocalizedPhrases = Record<AiAssistantLanguage, readonly string[]>;
type LocalizedReplies = Record<AiAssistantLanguage, string>;
type LocalizedKeywordGroups = Record<
  AiAssistantLanguage,
  readonly (readonly string[])[]
>;
type BasicIntentDefinition = {
  phrases: LocalizedPhrases;
  replies: LocalizedReplies;
};

type FaqIntentRule = {
  priority: number;
  aliases: LocalizedPhrases;
  keywordGroups: LocalizedKeywordGroups;
  patterns: readonly RegExp[];
};

const VIETNAMESE_MARKS =
  /[ăâđêôơưàáảãạấầẩẫậắằẳẵặèéẻẽẹếềểễệìíỉĩịòóỏõọốồổỗộớờởỡợùúủũụứừửữựỳýỷỹỵ]/i;
const VIETNAMESE_CUES = new Set([
  'alo',
  'bai',
  'ban',
  'biet',
  'bua',
  'cam',
  'chao',
  'chi',
  'cuoc',
  'dang',
  'dau',
  'gi',
  'giup',
  'gio',
  'hay',
  'hen',
  'hom',
  'ho',
  'khong',
  'ky',
  'lam',
  'lich',
  'loi',
  'mat',
  'nhap',
  'nop',
  'muon',
  'mua',
  'nay',
  'sao',
  'tap',
  'tai',
  'tam',
  'thi',
  'thong',
  'toi',
  'trang',
  'troi',
  'xem',
  'co',
  'nang',
  'lanh',
  'nong',
]);
const ENGLISH_CUES = new Set([
  'a',
  'an',
  'are',
  'can',
  'could',
  'did',
  'do',
  'does',
  'how',
  'is',
  'it',
  'my',
  'on',
  'the',
  'today',
  'tomorrow',
  'what',
  'where',
  'when',
  'who',
  'why',
  'will',
  'you',
]);
const VIETNAMESE_REQUEST_START =
  /^(?:xin chao|chao|toi|minh|ban|lam sao|la sao|hom nay|ngay mai|tai sao|o dau|the nao|dang nhap|dang ky)\b/;
const ENGLISH_REQUEST_START =
  /^(?:how|what|where|when|who|why|will|is|are|can|could|do|does|did|would|should|i|you|we|they|please|tell me|give me)\b/;
export const HIDDEN_TEST_VISIBILITY_QUESTION =
  /\b(?:does|do)\b.{0,70}\b(?:problem page|problem detail|de bai|chi tiet)\b.{0,50}\b(?:show|display|include)\b.{0,50}\bhidden tests?\b|\b(?:are|is|will)\b.{0,50}\bhidden tests?\b.{0,50}\b(?:shown|visible|displayed|included|hien|xuat hien)\b|\bhidden tests?\b.{0,50}\b(?:shown|visible|displayed|included|hien|xuat hien)\b/;

const FAQ_INTENT_RULES: Readonly<Record<AiAssistantFaqId, FaqIntentRule>> = {
  'account-access': {
    priority: 90,
    aliases: {
      vi: [
        'dang nhap',
        'dang xuat',
        'tao tai khoan',
        'dang ky tai khoan',
        'thoat tai khoan',
      ],
      en: [
        'log in',
        'login',
        'sign in',
        'log out',
        'logout',
        'sign out',
        'create account',
        'register account',
        'sign up',
      ],
    },
    keywordGroups: {
      vi: [
        ['dang', 'nhap'],
        ['dang', 'ky', 'tai', 'khoan'],
      ],
      en: [
        ['login', 'account'],
        ['register', 'account'],
      ],
    },
    patterns: [
      /\b(?:how|where|can|do|need|want|please|steps to|way to)\b.{0,40}\b(?:sign in|log in|login|log out|logout|sign out)\b/,
      /\b(?:how|where|can|do|need|want|please|steps to|way to)\b.{0,40}\b(?:register|registration|sign up)\b(?!\s+(?:for|to|a|the)\b.{0,30}\b(?:contest|competition)\b)/,
      /\b(?:register|registration|sign up|create|make)\b.{0,40}\baccount\b|\baccount\b.{0,40}\b(?:register|registration|sign up)\b/,
      /\b(?:dang nhap|dang xuat|thoat tai khoan|tao tai khoan)\b|\bdang ky\b.{0,40}\btai khoan\b/,
    ],
  },
  'oauth-sign-in': {
    priority: 92,
    aliases: {
      vi: [
        'dang nhap bang google',
        'dang nhap bang github',
        'dang ky bang google',
        'dang ky bang github',
      ],
      en: [
        'sign in with google',
        'sign in with github',
        'log in with google',
        'log in with github',
        'register with google',
        'register with github',
        'sign up with google',
        'sign up with github',
      ],
    },
    keywordGroups: {
      vi: [
        ['dang', 'nhap', 'google'],
        ['dang', 'nhap', 'github'],
        ['dang', 'ky', 'google'],
        ['dang', 'ky', 'github'],
      ],
      en: [
        ['login', 'google'],
        ['login', 'github'],
        ['register', 'google'],
        ['register', 'github'],
      ],
    },
    patterns: [
      /\b(?:log in|login|sign in|sign up|register|create account|dang nhap|dang ky|tao tai khoan)\b.{0,45}\b(?:google|github)\b|\b(?:google|github)\b.{0,45}\b(?:log in|login|sign in|sign up|register|create account|dang nhap|dang ky|tao tai khoan)\b/,
    ],
  },
  'password-reset': {
    priority: 100,
    aliases: {
      vi: ['quen mat khau', 'dat lai mat khau', 'khoi phuc mat khau'],
      en: ['forgot password', 'reset password', 'recover password'],
    },
    keywordGroups: {
      vi: [
        ['quen', 'mat', 'khau'],
        ['dat', 'lai', 'mat', 'khau'],
      ],
      en: [
        ['forgot', 'password'],
        ['reset', 'password'],
      ],
    },
    patterns: [
      /\b(?:forgot|reset|recover)\b.{0,40}\bpassword\b|\bpassword\b.{0,40}\b(?:reset|recovery)\b/,
      /\b(?:quen mat khau|dat lai mat khau|khoi phuc mat khau)\b/,
    ],
  },
  'password-change': {
    priority: 96,
    aliases: {
      vi: [
        'doi mat khau',
        'thay doi mat khau',
        'cap nhat mat khau',
        'thiet lap mat khau',
      ],
      en: [
        'change password',
        'change my password',
        'update my password',
        'set up a password',
      ],
    },
    keywordGroups: {
      vi: [
        ['doi', 'mat', 'khau'],
        ['thay', 'doi', 'mat', 'khau'],
      ],
      en: [
        ['change', 'password'],
        ['update', 'password'],
      ],
    },
    patterns: [
      /\b(?:change|update|set up)\b.{0,35}\bpassword\b|\bpassword\b.{0,35}\b(?:change|update)\b|\b(?:doi mat khau|thay doi mat khau|cap nhat mat khau|thiet lap mat khau)\b/,
    ],
  },
  'profile-management': {
    priority: 80,
    aliases: {
      vi: [
        'ho so ca nhan',
        'chinh sua ho so',
        'sua ho so',
        'anh dai dien',
        'anh bia',
      ],
      en: [
        'my profile',
        'edit profile',
        'update profile',
        'profile picture',
        'avatar',
      ],
    },
    keywordGroups: {
      vi: [
        ['ho', 'so', 'ca', 'nhan'],
        ['sua', 'ho', 'so'],
      ],
      en: [
        ['edit', 'profile'],
        ['update', 'avatar'],
      ],
    },
    patterns: [
      /\b(?:view|see|open|edit|update|change|manage|find)\b.{0,50}\b(?:profile|avatar|cover image|personal details|bio)\b|\b(?:profile|avatar|cover image|personal details|bio)\b.{0,50}\b(?:edit|update|change)\b/,
      /\b(?:xem|mo|sua|cap nhat|doi|chinh sua)\b.{0,50}\b(?:ho so|anh dai dien|anh bia|thong tin ca nhan)\b/,
    ],
  },
  'problem-search': {
    priority: 80,
    aliases: {
      vi: ['danh sach bai tap', 'tim bai tap', 'loc bai tap', 'duyet bai tap'],
      en: [
        'problem list',
        'search problems',
        'find problems',
        'browse problems',
        'filter problems',
      ],
    },
    keywordGroups: {
      vi: [
        ['tim', 'bai', 'tap'],
        ['danh', 'sach', 'bai', 'tap'],
      ],
      en: [
        ['search', 'problems'],
        ['find', 'problems'],
      ],
    },
    patterns: [
      /\b(?:search|find|browse|filter|list|sort)\b.{0,60}\b(?:problem|problems|exercise|exercises)\b|\bproblem list\b/,
      /\b(?:problem|problems|exercise|exercises)\b.{0,50}\b(?:search|list|filter|browse)\b/,
      /\b(?:tim|loc|liet ke|danh sach|duyet)\b.{0,60}\b(?:bai tap|bai)\b|\b(?:bai tap|bai)\b.{0,50}\b(?:tim|loc|danh sach)\b/,
    ],
  },
  'problem-details': {
    priority: 80,
    aliases: {
      vi: ['de bai', 'chi tiet bai tap', 'vi du bai tap', 'test an'],
      en: [
        'problem statement',
        'problem details',
        'problem examples',
        'hidden tests shown',
      ],
    },
    keywordGroups: {
      vi: [
        ['de', 'bai'],
        ['vi', 'du', 'mau'],
      ],
      en: [
        ['problem', 'statement'],
        ['problem', 'examples'],
      ],
    },
    patterns: [
      /\b(?:problem|exercise)\b.{0,50}\b(?:details|statement|examples|samples)\b|\b(?:details|statement|examples|samples)\b.{0,50}\b(?:problem|exercise)\b/,
      /\b(?:de bai|chi tiet bai tap|vi du mau|test an)\b/,
      HIDDEN_TEST_VISIBILITY_QUESTION,
    ],
  },
  'problem-editorial': {
    priority: 82,
    aliases: {
      vi: ['xem loi giai bai tap', 'mo khoa loi giai', 'loi giai bai tap'],
      en: [
        'problem editorial',
        'view a problem solution',
        'view the editorial',
        'unlock a problem solution',
      ],
    },
    keywordGroups: {
      vi: [
        ['xem', 'loi', 'giai'],
        ['mo', 'khoa', 'loi', 'giai'],
      ],
      en: [
        ['problem', 'editorial'],
        ['problem', 'solution'],
      ],
    },
    patterns: [
      /\b(?:view|see|open|unlock|read)\b.{0,45}\b(?:editorial|problem solution|solutions?)\b|\b(?:editorial|problem solution)\b.{0,45}\b(?:view|see|open|unlock|read)\b/,
      /\b(?:xem|mo|doc|mo khoa)\b.{0,45}\b(?:loi giai|giai thich bai tap)\b|\b(?:loi giai|giai thich bai tap)\b.{0,45}\b(?:xem|mo|doc|mo khoa)\b/,
    ],
  },
  'submit-problem': {
    priority: 80,
    aliases: {
      vi: ['nop bai', 'nop bai tap', 'gui bai', 'nop loi giai'],
      en: [
        'submit a solution',
        'submit my solution',
        'submit code',
        'send my solution',
      ],
    },
    keywordGroups: {
      vi: [
        ['nop', 'bai'],
        ['gui', 'bai'],
      ],
      en: [
        ['submit', 'solution'],
        ['submit', 'code'],
      ],
    },
    patterns: [
      /\b(?:submit|send)\b.{0,50}\b(?:solution|answer|work|submission)\b|\bhow\b.{0,40}\bsubmit\b/,
      /\b(?:nop bai|gui bai|nop loi giai|gui loi giai)\b/,
      /\b(?:muon|can|lam sao|cach)\b.{0,30}\bnop\s+(?:code|ma nguon|bai(?: tap)?|loi giai)\b/,
    ],
  },
  'submission-history': {
    priority: 70,
    aliases: {
      vi: ['lich su bai nop', 'xem bai nop', 'danh sach bai nop'],
      en: [
        'my submissions',
        'submission history',
        'submisison history',
        'view submissions',
        'my submission results',
      ],
    },
    keywordGroups: {
      vi: [
        ['lich', 'su', 'bai', 'nop'],
        ['xem', 'bai', 'nop'],
      ],
      en: [
        ['submission', 'history'],
        ['my', 'submissions'],
      ],
    },
    patterns: [
      /\b(?:view|check|find|list|history|where)\b.{0,60}\b(?:submission|submissions|my results)\b|\bmy submissions\b/,
      /\b(?:xem|kiem tra|tim|danh sach|lich su)\b.{0,60}\b(?:bai nop|bai lam|bai gui)\b/,
    ],
  },
  'submission-statuses': {
    priority: 70,
    aliases: {
      vi: [
        'trang thai bai nop',
        'ket qua cham',
        'loi bien dich',
        'sai ket qua',
      ],
      en: [
        'submission status',
        'submission verdict',
        'judging result',
        'wrong answer meaning',
        'queued status',
      ],
    },
    keywordGroups: {
      vi: [
        ['trang', 'thai', 'bai', 'nop'],
        ['ket', 'qua', 'cham'],
      ],
      en: [
        ['submission', 'status'],
        ['verdict', 'meaning'],
      ],
    },
    patterns: [
      /\b(?:status|verdict|result|mean|meaning|explain)\b.{0,60}\b(?:submission|queued|pending|running|accepted|wrong answer|time limit|memory limit|runtime error|compilation error|internal error|verdict|status)\b/,
      /\b(?:queued|pending|running|accepted|wrong answer|time limit exceeded|memory limit exceeded|runtime error|compilation error|internal error)\b.{0,50}\b(?:mean|meaning|status|verdict|result)\b/,
      /\b(?:trang thai|ket qua cham|co nghia gi|la gi|loi bien dich|sai ket qua)\b.{0,60}\b(?:bai nop|bai lam|queued|pending|running|accepted|wrong answer|tle|mle|re|ce)\b/,
    ],
  },
  contests: {
    priority: 80,
    aliases: {
      vi: ['cuoc thi', 'ky thi', 'tham gia ky thi', 'dang ky cuoc thi'],
      en: [
        'contest registration',
        'register for a contest',
        'join a contest',
        'participate in a contest',
        'competition registration',
      ],
    },
    keywordGroups: {
      vi: [
        ['tham', 'gia', 'cuoc', 'thi'],
        ['dang', 'ky', 'ky', 'thi'],
      ],
      en: [
        ['register', 'contest'],
        ['join', 'contest'],
      ],
    },
    patterns: [
      /\b(?:where|how|register|registration|sign up|join|participate|browse|find|search|list|view|upcoming)\b.{0,60}\b(?:contest|contests|competition|competitions)\b|\b(?:contest|contests|competition|competitions)\b.{0,60}\b(?:register|registration|join|participate|browse|find|search|list|view)\b/,
      /\b(?:dang ky|tham gia|duyet|tim|danh sach|xem|mo)\b.{0,60}\b(?:cuoc thi|ky thi)\b|\b(?:cuoc thi|ky thi)\b.{0,60}\b(?:dang ky|tham gia|danh sach|xem)\b/,
    ],
  },
  'contest-leaderboard': {
    priority: 88,
    aliases: {
      vi: [
        'bang xep hang cuoc thi',
        'bang xep hang ky thi',
        'xep hang cuoc thi',
      ],
      en: [
        'contest leaderboard',
        'leaderboard for a contest',
        'contest rankings',
        'competition leaderboard',
      ],
    },
    keywordGroups: {
      vi: [['bang', 'xep', 'hang', 'cuoc', 'thi']],
      en: [
        ['contest', 'leaderboard'],
        ['competition', 'leaderboard'],
      ],
    },
    patterns: [
      /\b(?:contest|competition|cuoc thi|ky thi)\b.{0,50}\b(?:leaderboard|ranking|rankings|bang xep hang|xep hang)\b|\b(?:leaderboard|ranking|rankings|bang xep hang|xep hang)\b.{0,50}\b(?:contest|competition|cuoc thi|ky thi)\b/,
    ],
  },
  'global-leaderboard': {
    priority: 80,
    aliases: {
      vi: ['bang xep hang', 'xep hang tong the'],
      en: ['leaderboard', 'global leaderboard', 'rankings', 'ranking'],
    },
    keywordGroups: {
      vi: [['bang', 'xep', 'hang']],
      en: [['global', 'leaderboard']],
    },
    patterns: [
      /\b(?:global|overall|sitewide)\b.{0,40}\b(?:leaderboard|ranking|rankings)\b|\b(?:leaderboard|ranking|rankings)\b.{0,40}\b(?:global|overall|sitewide)\b/,
      /\b(?:where|how|can|do|please|view|see|open|find|show)\b.{0,40}\b(?:leaderboard|ranking|rankings)\b/,
      /\b(?:xem|mo|tim|cho xem|danh sach)\b.{0,40}\b(?:bang xep hang|xep hang)\b/,
    ],
  },
  organizations: {
    priority: 70,
    aliases: {
      vi: ['to chuc', 'tham gia to chuc'],
      en: [
        'organization',
        'organizations',
        'browse organizations',
        'join an organization',
      ],
    },
    keywordGroups: {
      vi: [['tham', 'gia', 'to', 'chuc']],
      en: [
        ['browse', 'organizations'],
        ['join', 'organization'],
      ],
    },
    patterns: [
      /\b(?:browse|find|view|open|join|list|search)\b.{0,60}\b(?:organization|organizations|org)\b|\b(?:organization|organizations|org)\b.{0,60}\b(?:browse|find|view|open|join|list|search)\b/,
      /\b(?:xem|mo|tim|tham gia|danh sach)\b.{0,60}\bto chuc\b|\bto chuc\b.{0,60}\b(?:xem|mo|tim|tham gia|danh sach)\b/,
      /\b(?:toi )?muon vao to chuc\b/,
    ],
  },
  'discussions-comments': {
    priority: 70,
    aliases: {
      vi: ['thao luan', 'binh luan', 'binh luan bai tap'],
      en: [
        'discussion comments',
        'read discussions',
        'post a comment',
        'problem comments',
      ],
    },
    keywordGroups: {
      vi: [
        ['thao', 'luan'],
        ['binh', 'luan'],
      ],
      en: [
        ['read', 'discussions'],
        ['post', 'comment'],
      ],
    },
    patterns: [
      /\b(?:view|read|browse|list|find|post|create|add|write|reply)\b.{0,60}\b(?:discussion|discussions|comments?)\b|\b(?:discussion|discussions|comments?)\b.{0,50}\b(?:view|read|browse|list|post|create|add|reply)\b/,
      /\b(?:xem|doc|duyet|tim|dang|tao|viet|gui|tra loi)\b.{0,60}\b(?:thao luan|binh luan)\b|\b(?:thao luan|binh luan)\b.{0,50}\b(?:xem|doc|dang|tao|gui|tra loi)\b/,
    ],
  },
  notifications: {
    priority: 70,
    aliases: {
      vi: ['thong bao', 'danh dau thong bao da doc'],
      en: ['notifications', 'view notifications', 'mark notifications as read'],
    },
    keywordGroups: {
      vi: [['thong', 'bao']],
      en: [
        ['view', 'notifications'],
        ['notifications', 'read'],
      ],
    },
    patterns: [
      /\b(?:view|see|open|read|find|mark|check)\b.{0,60}\b(?:notification|notifications)\b|\b(?:notification|notifications)\b.{0,50}\b(?:view|read|mark|unread)\b/,
      /\b(?:xem|mo|doc|tim|danh dau|kiem tra)\b.{0,60}\bthong bao\b|\bthong bao\b.{0,50}\b(?:xem|doc|danh dau|chua doc)\b/,
    ],
  },
};

const BASIC_CONVERSATION: Record<
  AiAssistantBasicIntent,
  BasicIntentDefinition
> = {
  GREETING: {
    phrases: {
      vi: [
        'xin chao',
        'chao ban',
        'chao',
        'alo',
        'chao buoi sang',
        'chao buoi chieu',
        'chao buoi toi',
      ],
      en: [
        'hello',
        'hi',
        'hey',
        'good morning',
        'good afternoon',
        'good evening',
      ],
    },
    replies: {
      vi: 'Xin chào! Mình là UTH AI Assistant. Mình có thể hướng dẫn bạn đăng ký hoặc đăng nhập, tìm bài tập, nộp bài và xem kết quả chấm trên UTH Online Judge.',
      en: 'Hello! I’m UTH AI Assistant. I can guide you through signing up or in, finding problems, submitting work, and viewing judging results on UTH Online Judge.',
    },
  },
  THANKS: {
    phrases: {
      vi: ['cam on', 'cam on ban', 'cam on nha', 'cam on nhieu'],
      en: ['thanks', 'thank you', 'thanks a lot', 'many thanks'],
    },
    replies: {
      vi: 'Rất vui được hỗ trợ bạn!',
      en: 'You’re welcome!',
    },
  },
  GOODBYE: {
    phrases: {
      vi: ['tam biet', 'hen gap lai'],
      en: ['bye', 'goodbye', 'see you', 'see you later'],
    },
    replies: {
      vi: 'Tạm biệt! Chúc bạn có trải nghiệm tốt trên UTH Online Judge.',
      en: 'Goodbye! I hope you have a great experience on UTH Online Judge.',
    },
  },
  CAPABILITIES: {
    phrases: {
      vi: [
        'ban co the giup gi',
        'ban lam duoc gi',
        'chatbot nay dung de lam gi',
        'ban ho tro nhung gi',
      ],
      en: [
        'what can you do',
        'how can you help me',
        'what can you help with',
        'what are your capabilities',
      ],
    },
    replies: {
      vi: 'Mình có thể hướng dẫn cách dùng các chức năng đã được xác minh của UTH Online Judge, như tài khoản, bài tập, bài nộp, cuộc thi và các khu vực thảo luận.',
      en: 'I can guide you through verified UTH Online Judge features, including accounts, problems, submissions, contests, and discussions.',
    },
  },
  BOT_IDENTITY: {
    phrases: {
      vi: ['ban la ai', 'ban ten gi', 'ban co phai bot khong'],
      en: ['who are you', 'what is your name', 'are you a bot'],
    },
    replies: {
      vi: 'Mình là UTH AI Assistant, trợ lý hướng dẫn sử dụng UTH Online Judge.',
      en: 'I’m UTH AI Assistant, a guide to using UTH Online Judge.',
    },
  },
};

const MINIMUM_MATCH_SCORE = 60;
const AMBIGUITY_MARGIN = 15;
const FUZZY_MAX_INPUT_LENGTH = 240;
const FUZZY_MAX_TOKENS = 30;
const FUZZY_PROTECTED_TERMS =
  /\b(?:ignore|bypass|override|reveal|secret|credential|password|passcode|token|cookie|jwt|hidden tests?|private data|api key|source code|sql|database|admin|developer mode|ac|wa|tle|mle|re|ce)\b/;
const FUZZY_VOCABULARY = new Set([
  ...Object.values(FAQ_INTENT_RULES).flatMap((rule) =>
    Object.values(rule.aliases).flatMap((phrases) =>
      phrases.flatMap((phrase) =>
        normalizeAiAssistantQuestion(phrase).split(' '),
      ),
    ),
  ),
  ...AI_ASSISTANT_FAQ.flatMap((faq) =>
    Object.values(faq.question).flatMap((question) =>
      normalizeAiAssistantQuestion(question).split(' '),
    ),
  ),
  'lam',
  'bai',
  'tap',
  'nhu',
  'nao',
  'sao',
  'vay',
  'muon',
  'web',
  'dung',
  'sai',
  'ntn',
  'bt',
]);

function boundedEditDistance(left: string, right: string): number {
  if (Math.abs(left.length - right.length) > 1) return 2;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const value = Math.min(
        previous[rightIndex]! + 1,
        current[rightIndex - 1]! + 1,
        previous[rightIndex - 1]! + cost,
      );
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > 1) return 2;
    previous = current;
  }
  return previous[right.length]!;
}

export function normalizeAiAssistantFuzzyQuestion(
  question: string,
): string | undefined {
  if (
    question.length > FUZZY_MAX_INPUT_LENGTH ||
    FUZZY_PROTECTED_TERMS.test(normalizeAiAssistantQuestion(question))
  ) {
    return undefined;
  }

  const tokens = normalizeAiAssistantQuestion(question).split(' ');
  if (tokens.length > FUZZY_MAX_TOKENS) return undefined;
  if (tokens[0] === 'lm' && (tokens[1] === 'bai' || tokens[1] === 'bt')) {
    tokens[0] = 'lam';
  }
  if (tokens[0] === 'am' && tokens[1] === 'bai' && tokens[2] === 'tap') {
    tokens[0] = 'lam';
  }
  if (
    tokens.includes('bt') &&
    tokens.some((token) => ['lam', 'muon', 'nop', 'tim', 'xem'].includes(token))
  ) {
    const index = tokens.indexOf('bt');
    tokens.splice(index, 1, 'bai', 'tap');
  }
  if (tokens.includes('ntn')) {
    const index = tokens.indexOf('ntn');
    tokens.splice(index, 1, 'nhu', 'nao');
  }
  if (tokens.at(-1) === 'v' && tokens.at(-2) === 'sao') {
    tokens[tokens.length - 1] = 'vay';
  }

  const correctedTokens = tokens.map((token) => {
    if (token.length < 3 || FUZZY_VOCABULARY.has(token)) return token;
    let nearest: string | undefined;
    for (const candidate of FUZZY_VOCABULARY) {
      if (boundedEditDistance(token, candidate) !== 1) continue;
      if (nearest) return token;
      nearest = candidate;
    }
    return nearest ?? token;
  });
  const normalized = correctedTokens.join(' ');
  return normalized === normalizeAiAssistantQuestion(question)
    ? undefined
    : normalized;
}

function containsPhrase(question: string, phrase: string): boolean {
  return ` ${question} `.includes(` ${normalizeAiAssistantQuestion(phrase)} `);
}

export function normalizeAiAssistantQuestion(question: string): string {
  return question
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('đ', 'd')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

export function detectAiAssistantLanguage(
  question: string,
  normalized: string,
): AiAssistantLanguage {
  const startsWithVietnamese = VIETNAMESE_REQUEST_START.test(normalized);
  const startsWithEnglish = ENGLISH_REQUEST_START.test(normalized);
  if (startsWithVietnamese !== startsWithEnglish) {
    return startsWithVietnamese ? 'vi' : 'en';
  }
  if (VIETNAMESE_MARKS.test(question)) return 'vi';

  const tokens = normalized.split(' ');
  const vietnameseScore = tokens.filter((token) =>
    VIETNAMESE_CUES.has(token),
  ).length;
  const englishScore = tokens.filter((token) => ENGLISH_CUES.has(token)).length;
  return vietnameseScore > englishScore ? 'vi' : 'en';
}

type BasicConversationMatch = {
  intent: AiAssistantBasicIntent;
  answer: string;
};

function findBasicIntent(
  normalized: string,
  language: AiAssistantLanguage,
): BasicConversationMatch | undefined {
  for (const intent of Object.keys(
    BASIC_CONVERSATION,
  ) as AiAssistantBasicIntent[]) {
    const definition = BASIC_CONVERSATION[intent];
    if (
      definition.phrases.vi.includes(normalized) ||
      definition.phrases.en.includes(normalized)
    ) {
      return { intent, answer: definition.replies[language] };
    }
  }
  return undefined;
}

export function matchBasicConversation(
  normalized: string,
  language: AiAssistantLanguage,
): BasicConversationMatch | undefined {
  const exactMatch = findBasicIntent(normalized, language);
  if (exactMatch) return exactMatch;

  const greetings = [
    ...BASIC_CONVERSATION.GREETING.phrases.vi,
    ...BASIC_CONVERSATION.GREETING.phrases.en,
  ].sort((left, right) => right.length - left.length);
  for (const greeting of greetings) {
    const prefix = `${normalizeAiAssistantQuestion(greeting)} `;
    if (!normalized.startsWith(prefix)) continue;
    return findBasicIntent(normalized.slice(prefix.length), language);
  }

  return undefined;
}

type RankedFaqMatch = {
  faq: AiAssistantFaqEntry;
  score: number;
  priority: number;
};

const FAQ_ACTION_CONTEXT =
  /\b(?:how|where|what|can|do|does|is|are|please|help|need|want|find|search|browse|view|see|open|list|filter|sort|edit|update|change|manage|register|join|participate|submit|send|post|read|check|mark|reset|recover|forgot|log|sign|lam sao|o dau|the nao|giup|tim|xem|mo|danh sach|loc|sap xep|sua|cap nhat|doi|quan ly|dang ky|tham gia|nop|gui|doc|kiem tra|danh dau|dat lai|quen)\b/;
const CONTEST_LEADERBOARD =
  /\b(?:contest|competition|cuoc thi|ky thi)\b.{0,50}\b(?:leaderboard|ranking|rankings|bang xep hang|xep hang)\b|\b(?:leaderboard|ranking|rankings|bang xep hang|xep hang)\b.{0,50}\b(?:contest|competition|cuoc thi|ky thi)\b/;
const GLOBAL_LEADERBOARD_CONTEXT =
  /\b(?:global|overall|sitewide|toan he thong|tong the)\b/;

export type AiAssistantFaqMatch =
  | { kind: 'matched'; faq: AiAssistantFaqEntry }
  | { kind: 'ambiguous' }
  | { kind: 'none' };

const OAUTH_AUTHENTICATION_REQUEST =
  /\b(?:log in|login|sign in|sign up|register|create account|dang nhap|dang ky|tao tai khoan)\b.{0,45}\b(?:google|github)\b|\b(?:google|github)\b.{0,45}\b(?:log in|login|sign in|sign up|register|create account|dang nhap|dang ky|tao tai khoan)\b/;
const AUTHENTICATED_PASSWORD_CHANGE =
  /\b(?:change|update)\b.{0,25}\bpassword\b.{0,40}\b(?:while|when|after|already)\b.{0,25}\b(?:logged in|signed in|login|signing in)\b|\b(?:while|when|after|already)\b.{0,25}\b(?:logged in|signed in|login|signing in)\b.{0,40}\b(?:change|update)\b.{0,25}\bpassword\b|\bdoi mat khau\b.{0,30}\b(?:khi|sau khi|da)\b.{0,20}\bdang nhap\b|\b(?:khi|sau khi|da)\b.{0,20}\bdang nhap\b.{0,30}\bdoi mat khau\b/;

function scoreFaqIntent(
  normalized: string,
  faqId: AiAssistantFaqId,
  rule: FaqIntentRule,
): number {
  if (
    (faqId === 'account-access' &&
      OAUTH_AUTHENTICATION_REQUEST.test(normalized)) ||
    (faqId === 'account-access' &&
      AUTHENTICATED_PASSWORD_CHANGE.test(normalized)) ||
    (faqId === 'contests' && CONTEST_LEADERBOARD.test(normalized)) ||
    (faqId === 'global-leaderboard' &&
      CONTEST_LEADERBOARD.test(normalized) &&
      !GLOBAL_LEADERBOARD_CONTEXT.test(normalized))
  ) {
    return 0;
  }

  let score = 0;
  for (const phrases of Object.values(rule.aliases)) {
    for (const phrase of phrases) {
      const normalizedPhrase = normalizeAiAssistantQuestion(phrase);
      if (!normalizedPhrase.includes(' ')) continue;
      if (normalized === normalizedPhrase) score = Math.max(score, 100);
      else if (containsPhrase(normalized, normalizedPhrase)) {
        if (FAQ_ACTION_CONTEXT.test(normalized)) score = Math.max(score, 88);
      }
    }
  }

  if (rule.patterns.some((pattern) => pattern.test(normalized))) {
    score = Math.max(score, 76);
  }

  const tokens = new Set(normalized.split(' '));
  for (const groups of Object.values(rule.keywordGroups)) {
    if (groups.some((group) => group.every((word) => tokens.has(word)))) {
      score = Math.max(score, 60);
    }
  }
  return score;
}

export function matchFaqIntent(normalized: string): AiAssistantFaqMatch {
  const rankedMatches: RankedFaqMatch[] = [];
  for (const faq of AI_ASSISTANT_FAQ) {
    const rule = FAQ_INTENT_RULES[faq.id];
    const score = scoreFaqIntent(normalized, faq.id, rule);
    if (score >= MINIMUM_MATCH_SCORE) {
      rankedMatches.push({ faq, score, priority: rule.priority });
    }
  }

  rankedMatches.sort(
    (left, right) =>
      right.score - left.score ||
      right.priority - left.priority ||
      left.faq.id.localeCompare(right.faq.id),
  );
  if (rankedMatches.filter(({ score }) => score >= 76).length > 1) {
    return { kind: 'ambiguous' };
  }

  const best = rankedMatches[0];
  if (!best) return { kind: 'none' };

  const runnerUp = rankedMatches[1];
  if (runnerUp && best.score - runnerUp.score < AMBIGUITY_MARGIN) {
    return { kind: 'ambiguous' };
  }
  return { kind: 'matched', faq: best.faq };
}
