import type {
  AiAssistantFaqEntry,
  AiAssistantGlossaryEntry,
} from './ai-assistant.types.js';

export const AI_ASSISTANT_FAQ: readonly AiAssistantFaqEntry[] = [
  {
    id: 'account-access',
    topic: 'account',
    question: {
      vi: 'Tôi đăng ký, đăng nhập hoặc đăng xuất như thế nào?',
      en: 'How do I register, sign in, or sign out?',
    },
    answer: {
      vi: 'Nếu chưa có tài khoản, chọn Đăng ký. Nếu đã có tài khoản, chọn Đăng nhập. Để đăng xuất, chọn “Đăng xuất” trong menu tài khoản ở thanh đầu trang.',
      en: 'Choose Register if you do not have an account yet. If you already have one, choose Sign in. To log out, select “Log out” from the account menu in the top bar.',
    },
    technicalAnswer: {
      vi: 'Đăng ký tại /register và đăng nhập tại /login.',
      en: 'Register at /register and sign in at /login.',
    },
    approvedStatements: [
      {
        id: 'register-and-sign-in',
        phrases: {
          vi: [
            'Nếu chưa có tài khoản, chọn Đăng ký.',
            'Nếu đã có tài khoản, chọn Đăng nhập.',
            'Bạn có thể chọn Đăng ký để tạo tài khoản hoặc Đăng nhập nếu đã có tài khoản.',
          ],
          en: [
            'Choose Register if you do not have an account yet.',
            'If you already have one, choose Sign in.',
            'Choose Register to create an account, or Sign in if you already have one.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Đăng ký tại /register và đăng nhập tại /login.',
            'Bạn có thể đăng ký ở /register và đăng nhập ở /login.',
          ],
          en: [
            'Register at /register and sign in at /login.',
            'Create an account at /register, then sign in at /login.',
          ],
        },
      },
      {
        id: 'sign-out',
        phrases: {
          vi: [
            'Khi đã đăng nhập, mở menu tài khoản trên thanh đầu trang và chọn “Đăng xuất”.',
            'Để đăng xuất, chọn “Đăng xuất” trong menu tài khoản ở thanh đầu trang.',
          ],
          en: [
            'When signed in, open the account menu in the top bar and select “Log out”.',
            'To log out, select “Log out” from the account menu in the top bar.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:92-93',
      'frontend/src/components/layout/SiteHeader.tsx:254-258',
      'backend/src/auth/auth.controller.ts:130-199,405-420',
    ],
    allowedRoutes: ['/register', '/login'],
  },
  {
    id: 'password-reset',
    topic: 'account',
    question: {
      vi: 'Tôi quên mật khẩu hoặc muốn đặt lại mật khẩu thì làm sao?',
      en: 'How do I reset a forgotten password?',
    },
    answer: {
      vi: 'Tại trang Đăng nhập, chọn “Quên mật khẩu?” rồi làm theo hướng dẫn để nhận mã xác minh và đặt mật khẩu mới. Thông báo yêu cầu mã không tiết lộ email có gắn với tài khoản hay không.',
      en: 'On the Sign in page, choose “Forgot password?” and follow the steps to verify your email and set a new password. The code-request message does not reveal whether the email belongs to an account.',
    },
    technicalAnswer: {
      vi: 'Vào /forgot-password để yêu cầu mã xác minh qua email và làm theo hướng dẫn đặt mật khẩu mới.',
      en: 'Open /forgot-password, request an email verification code, verify it, and set a new password by following the page.',
    },
    approvedStatements: [
      {
        id: 'reset-password-steps',
        phrases: {
          vi: [
            'Tại trang Đăng nhập, chọn “Quên mật khẩu?” rồi làm theo hướng dẫn để nhận mã xác minh và đặt mật khẩu mới.',
            'Chọn “Quên mật khẩu?” trên trang Đăng nhập, sau đó làm theo hướng dẫn trên trang.',
          ],
          en: [
            'On the Sign in page, choose “Forgot password?” and follow the steps to verify your email and set a new password.',
            'Choose “Forgot password?” on the Sign in page, then follow the instructions.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Mở /forgot-password, yêu cầu mã xác minh gửi đến email, xác minh mã rồi đặt mật khẩu mới theo hướng dẫn trên trang.',
            'Vào /forgot-password để yêu cầu mã xác minh qua email và làm theo hướng dẫn đặt mật khẩu mới.',
          ],
          en: [
            'Open /forgot-password, request an email verification code, verify it, and set a new password by following the page.',
            'Visit /forgot-password, request and verify the email code, then follow the page to set a new password.',
          ],
        },
      },
      {
        id: 'generic-email-message',
        phrases: {
          vi: [
            'Hệ thống dùng thông báo chung khi yêu cầu mã để không xác nhận email có tài khoản hay không.',
            'Thông báo yêu cầu mã không tiết lộ email có gắn với tài khoản hay không.',
          ],
          en: [
            'The system uses a generic request message rather than confirming whether an email has an account.',
            'The code-request message does not reveal whether the email belongs to an account.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:94',
      'frontend/src/features/auth/pages/ForgotPasswordPage.tsx:103-180',
      'backend/src/auth/auth.controller.ts:97-128',
      'backend/src/auth/password-reset.service.ts:27-89',
    ],
    allowedRoutes: ['/forgot-password'],
  },
  {
    id: 'profile-management',
    topic: 'profile',
    question: {
      vi: 'Tôi xem hoặc chỉnh sửa hồ sơ cá nhân ở đâu?',
      en: 'Where can I view or edit my profile?',
    },
    answer: {
      vi: 'Mở menu tài khoản trên thanh đầu trang và chọn Thông tin cá nhân để xem hồ sơ. Chọn Chỉnh sửa hồ sơ trong menu tài khoản để cập nhật thông tin. Bạn cần đăng nhập để sửa hồ sơ.',
      en: 'Open the account menu in the top bar and choose Profile to view your details. Choose Edit profile from the account menu to update your details. You need to sign in to edit your profile.',
    },
    technicalAnswer: {
      vi: 'Mở /profile để xem hồ sơ. Chỉnh sửa hồ sơ tại /profile/edit, hoặc qua mục Chỉnh sửa hồ sơ trong menu tài khoản.',
      en: 'Open /profile to view your profile. Edit your profile at /profile/edit or from Edit profile in the account menu.',
    },
    approvedStatements: [
      {
        id: 'view-profile',
        phrases: {
          vi: [
            'Mở menu tài khoản trên thanh đầu trang và chọn Thông tin cá nhân để xem hồ sơ.',
            'Chọn Thông tin cá nhân trong menu tài khoản để xem hồ sơ.',
          ],
          en: [
            'Open the account menu in the top bar and choose Profile to view your details.',
            'Choose Profile from the account menu to view your details.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Mở /profile để xem hồ sơ.',
            'Bạn có thể xem hồ sơ tại /profile.',
          ],
          en: [
            'Open /profile to view your profile.',
            'You can view your profile at /profile.',
          ],
        },
      },
      {
        id: 'edit-profile',
        phrases: {
          vi: [
            'Chọn Chỉnh sửa hồ sơ trong menu tài khoản để cập nhật thông tin.',
            'Bạn có thể chọn Chỉnh sửa hồ sơ trong menu tài khoản.',
          ],
          en: [
            'Choose Edit profile from the account menu to update your details.',
            'You can choose Edit profile from the account menu.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Để chỉnh sửa, mở /profile/edit hoặc chọn Chỉnh sửa hồ sơ trong menu tài khoản.',
            'Chỉnh sửa hồ sơ tại /profile/edit, hoặc qua mục Chỉnh sửa hồ sơ trong menu tài khoản.',
          ],
          en: [
            'To edit it, open /profile/edit or choose Edit profile from the account menu.',
            'Edit your profile at /profile/edit or from Edit profile in the account menu.',
          ],
        },
      },
      {
        id: 'profile-sign-in',
        phrases: {
          vi: [
            'Chỉnh sửa hồ sơ yêu cầu đăng nhập.',
            'Bạn cần đăng nhập để sửa hồ sơ.',
          ],
          en: [
            'Editing requires sign-in.',
            'You need to sign in to edit your profile.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:95-96',
      'frontend/src/components/layout/SiteHeader.tsx:235-251',
      'frontend/src/features/profile/pages/ProfileEditPage.tsx:1-44',
      'backend/src/auth/auth.controller.ts:422-441,529-568',
    ],
    allowedRoutes: ['/profile', '/profile/edit'],
  },
  {
    id: 'problem-search',
    topic: 'problems',
    question: {
      vi: 'Tôi tìm và lọc danh sách bài tập như thế nào?',
      en: 'How do I search and filter the problem list?',
    },
    answer: {
      vi: 'Chọn Bài tập trên thanh menu để duyệt danh sách. Bạn có thể tìm theo tên hoặc mã bài, lọc theo chủ đề hoặc trạng thái, rồi sắp xếp kết quả hoặc chuyển trang.',
      en: 'Choose Problems from the navigation menu to browse the list. Search by title or code, filter by topic or status, then sort the results or move between pages.',
    },
    technicalAnswer: {
      vi: 'Mở /problems để xem bài tập đã xuất bản.',
      en: 'Open /problems to browse published problems.',
    },
    approvedStatements: [
      {
        id: 'published-problem-list',
        phrases: {
          vi: [
            'Chọn Bài tập trên thanh menu để duyệt danh sách.',
            'Mục Bài tập trên thanh menu mở danh sách bài tập.',
          ],
          en: [
            'Choose Problems from the navigation menu to browse the list.',
            'The Problems item in the navigation menu opens the problem list.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Mở /problems để xem bài tập đã xuất bản.',
            'Danh sách bài tập có tại /problems.',
          ],
          en: [
            'Open /problems to browse published problems.',
            'Browse published problems at /problems.',
            'The problem list is at /problems.',
          ],
        },
      },
      {
        id: 'problem-list-filters',
        phrases: {
          vi: [
            'Bạn có thể tìm theo tên hoặc mã bài, lọc theo chủ đề hoặc trạng thái, rồi sắp xếp kết quả hoặc chuyển trang.',
            'Tìm bài theo tên hoặc mã, lọc theo chủ đề hoặc trạng thái, và sắp xếp danh sách theo nhu cầu.',
          ],
          en: [
            'Search by title or code, filter by topic or status, then sort the results or move between pages.',
            'Find a problem by title or code, filter by topic or status, and sort the list as needed.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:99',
      'backend/src/problems/problems.controller.ts:21-28',
      'backend/src/problems/dto/list-problems-query.dto.ts',
    ],
    allowedRoutes: ['/problems'],
  },
  {
    id: 'problem-details',
    topic: 'problems',
    question: {
      vi: 'Tôi xem đề bài và ví dụ ở đâu? Trang có hiển thị test ẩn không?',
      en: 'Where can I read a problem statement and examples? Are hidden tests shown?',
    },
    answer: {
      vi: 'Trong mục Bài tập, chọn một bài đã xuất bản để xem đề và ví dụ công khai. Test case ẩn không được hiển thị trên trang chi tiết.',
      en: 'In Problems, choose a published problem to read its statement and public examples. Hidden test cases are not shown on the detail page.',
    },
    technicalAnswer: {
      vi: 'Mở một bài đã xuất bản tại /problems/:code để xem chi tiết và các ví dụ công khai. Test case ẩn không được hiển thị trên trang chi tiết.',
      en: 'Open a published problem at /problems/:code to view its details and public examples. Hidden test cases are not shown on the detail page.',
    },
    approvedStatements: [
      {
        id: 'published-problem-details',
        phrases: {
          vi: [
            'Trong mục Bài tập, chọn một bài đã xuất bản để xem đề và ví dụ công khai.',
            'Mở một bài tập đã xuất bản để xem đề bài và các ví dụ công khai.',
          ],
          en: [
            'In Problems, choose a published problem to read its statement and public examples.',
            'Open a published problem to view its statement and public examples.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Mở một bài đã xuất bản tại /problems/:code để xem chi tiết và các ví dụ công khai.',
            'Xem đề bài và ví dụ công khai tại /problems/:code của bài đã xuất bản.',
          ],
          en: [
            'Open a published problem at /problems/:code to view its details and public examples.',
            'View a published problem statement and public examples at /problems/:code.',
          ],
        },
      },
      {
        id: 'hidden-tests-not-shown',
        phrases: {
          vi: [
            'Trang chi tiết không trả về test case ẩn.',
            'Test case ẩn không được hiển thị trên trang chi tiết.',
          ],
          en: [
            'The detail page does not return hidden test cases.',
            'Hidden test cases are not shown on the detail page.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:100',
      'backend/src/problems/problems.controller.ts:42-57',
      'backend/src/problems/problems.types.ts:35-60',
    ],
    allowedRoutes: ['/problems/:code'],
  },
  {
    id: 'submit-problem',
    topic: 'submissions',
    question: {
      vi: 'Tôi nộp bài tập như thế nào?',
      en: 'How do I submit a solution?',
    },
    answer: {
      vi: 'Đăng nhập, mở bài tập bạn muốn làm, rồi chọn Gửi bài giải để gửi mã nguồn. Sau khi gửi, chọn Bài nộp của tôi để theo dõi quá trình chấm.',
      en: 'Sign in, open the problem you want to solve, and choose Submit solution to send your code. After submitting, choose My submissions to follow the judging process.',
    },
    technicalAnswer: {
      vi: 'Bạn cần đăng nhập, mở trang nộp bài của bài tập tại /problems/:code/submit rồi gửi bài. Bài nộp được xếp vào hàng đợi chấm và có thể bắt đầu với trạng thái QUEUED.',
      en: 'Sign in, open the problem submission page at /problems/:code/submit, and submit your work. The submission is queued for judging and may initially show QUEUED.',
    },
    approvedStatements: [
      {
        id: 'submit-problem',
        phrases: {
          vi: [
            'Đăng nhập, mở bài tập bạn muốn làm, rồi chọn Gửi bài giải để gửi mã nguồn.',
            'Đăng nhập, mở bài tập và chọn Gửi bài giải để gửi mã nguồn.',
          ],
          en: [
            'Sign in, open the problem you want to solve, and choose Submit solution to send your code.',
            'Sign in, open a problem, and choose Submit solution to send your code.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Bạn cần đăng nhập, mở trang nộp bài của bài tập tại /problems/:code/submit rồi gửi bài.',
            'Đăng nhập trước, rồi mở /problems/:code/submit để nộp bài.',
          ],
          en: [
            'Sign in, open the problem submission page at /problems/:code/submit, and submit your work.',
            'Sign in, then submit your work from /problems/:code/submit.',
          ],
        },
      },
      {
        id: 'queued-for-judging',
        phrases: {
          vi: [
            'Sau khi gửi, bài làm sẽ được đưa vào hàng đợi chấm.',
            'Hệ thống sẽ xếp bài làm vào hàng đợi để chấm.',
          ],
          en: [
            'After you submit, your solution is placed in the judging queue.',
            'The system queues your solution for judging.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Bài nộp được xếp vào hàng đợi chấm và có thể bắt đầu với trạng thái QUEUED.',
            'Bài nộp được đưa vào hàng đợi chấm và ban đầu có thể mang trạng thái QUEUED.',
          ],
          en: [
            'The submission is queued for judging and may initially show QUEUED.',
            'A submission enters the judging queue and may first have the QUEUED status.',
          ],
        },
      },
      {
        id: 'track-submission',
        phrases: {
          vi: [
            'Sau khi gửi, chọn Bài nộp của tôi để theo dõi quá trình chấm.',
            'Chọn Bài nộp của tôi để xem tiến trình chấm bài.',
          ],
          en: [
            'After submitting, choose My submissions to follow the judging process.',
            'Choose My submissions to follow your solution’s progress.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:101-104',
      'backend/src/submissions/submissions.controller.ts:33-62',
      'backend/src/submissions/submissions.service.ts:35-49,79-109',
    ],
    allowedRoutes: ['/problems/:code/submit'],
  },
  {
    id: 'submission-history',
    topic: 'submissions',
    question: {
      vi: 'Tôi xem danh sách bài nộp và kết quả của mình ở đâu?',
      en: 'Where can I view my submissions and results?',
    },
    answer: {
      vi: 'Mở bài tập bạn đã làm rồi chọn Bài nộp của tôi để xem các lần nộp. Bảng chấm bài trên thanh menu hiển thị thông tin bài nộp công khai, không hiển thị mã nguồn. Chỉ chủ sở hữu đã đăng nhập mới xem được chi tiết bài nộp.',
      en: 'Open a problem you have worked on and choose My submissions to see your attempts. The Submissions page in the navigation shows public submission details, not source code. Only the signed-in owner can view a submission’s details.',
    },
    technicalAnswer: {
      vi: 'Mở /submissions để xem bảng bài nộp công khai; bảng này không hiển thị mã nguồn. Để xem bài nộp của mình theo một bài tập, mở /problems/:code/submissions/me. Chi tiết tại /submissions/:submissionId chỉ dành cho chủ sở hữu đã đăng nhập.',
      en: 'Open /submissions to view the public submissions board; it does not show source code. To view your submissions for a problem, open /problems/:code/submissions/me. Details at /submissions/:submissionId are available only to the signed-in owner.',
    },
    approvedStatements: [
      {
        id: 'public-submission-list',
        phrases: {
          vi: [
            'Bảng chấm bài trên thanh menu hiển thị thông tin bài nộp công khai, không hiển thị mã nguồn.',
            'Chọn Bảng chấm bài trên thanh menu để xem thông tin bài nộp công khai; mã nguồn không hiển thị ở đây.',
          ],
          en: [
            'The Submissions page in the navigation shows public submission details, not source code.',
            'Choose Submissions from the navigation to view public submission details; source code is not shown there.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Mở /submissions để xem bảng bài nộp công khai; bảng này không hiển thị mã nguồn.',
            'Bảng bài nộp công khai nằm tại /submissions và không hiển thị mã nguồn.',
          ],
          en: [
            'Open /submissions to view the public submissions board; it does not show source code.',
            'The public submissions board is at /submissions; source code is not shown there.',
          ],
        },
      },
      {
        id: 'my-problem-submissions',
        phrases: {
          vi: [
            'Mở bài tập bạn đã làm rồi chọn Bài nộp của tôi để xem các lần nộp.',
            'Trong trang bài tập, chọn Bài nộp của tôi để xem các lần bạn đã gửi.',
          ],
          en: [
            'Open a problem you have worked on and choose My submissions to see your attempts.',
            'Choose My submissions on a problem page to view the solutions you have submitted.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Để xem bài nộp của mình theo một bài tập, mở /problems/:code/submissions/me.',
            'Bài nộp của bạn cho từng bài tập có tại /problems/:code/submissions/me.',
          ],
          en: [
            'To view your submissions for a problem, open /problems/:code/submissions/me.',
            'Your submissions for a problem are at /problems/:code/submissions/me.',
          ],
        },
      },
      {
        id: 'submission-detail-access',
        phrases: {
          vi: [
            'Chỉ chủ sở hữu đã đăng nhập mới xem được chi tiết bài nộp.',
            'Bạn cần đăng nhập bằng tài khoản đã gửi bài để xem chi tiết của bài nộp đó.',
          ],
          en: [
            'Only the signed-in owner can view a submission’s details.',
            'Sign in with the account that submitted the solution to view its details.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Chi tiết tại /submissions/:submissionId chỉ dành cho chủ sở hữu đã đăng nhập.',
            'Chỉ chủ sở hữu đã đăng nhập mới có thể mở /submissions/:submissionId.',
          ],
          en: [
            'Details at /submissions/:submissionId are available only to the signed-in owner.',
            'Only the signed-in owner can view /submissions/:submissionId.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:114-120,128-131',
      'backend/src/submissions/submissions.controller.ts:67-107',
    ],
    allowedRoutes: [
      '/submissions',
      '/problems/:code/submissions/me',
      '/submissions/:submissionId',
    ],
  },
  {
    id: 'submission-statuses',
    topic: 'submissions',
    question: {
      vi: 'Các trạng thái và kết quả chấm bài có ý nghĩa gì?',
      en: 'What do submission statuses and verdicts mean?',
    },
    answer: {
      vi: 'Trong Bài nộp của tôi, bạn có thể xem bài đang chờ chấm hay đã có kết quả. Nếu bài làm chưa được chấp nhận, hãy đọc thông báo kết quả, chỉnh sửa mã nguồn nếu cần rồi chọn Gửi bài giải để nộp lại.',
      en: 'In My submissions, you can see whether a solution is waiting to be judged or has a result. If your solution is not accepted, review the result, make any needed changes, and choose Submit solution to try again.',
    },
    technicalAnswer: {
      vi: 'PENDING là chờ xử lý, QUEUED là đang chờ trong hàng đợi, RUNNING là đang chấm. Các kết quả gồm ACCEPTED (đạt), WRONG_ANSWER (sai kết quả), TIME_LIMIT_EXCEEDED (vượt giới hạn thời gian), MEMORY_LIMIT_EXCEEDED (vượt giới hạn bộ nhớ), RUNTIME_ERROR (lỗi khi chạy), COMPILATION_ERROR (lỗi biên dịch) và INTERNAL_ERROR (lỗi hệ thống).',
      en: 'PENDING means waiting for processing, QUEUED means waiting in the queue, and RUNNING means judging is in progress. Final verdicts include ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, RUNTIME_ERROR, COMPILATION_ERROR, and INTERNAL_ERROR.',
    },
    approvedStatements: [
      {
        id: 'submission-progress-statuses',
        phrases: {
          vi: [
            'Trong Bài nộp của tôi, bạn có thể xem bài đang chờ chấm hay đã có kết quả.',
            'Mục Bài nộp của tôi cho biết bài đang được chấm hoặc đã có kết quả.',
          ],
          en: [
            'In My submissions, you can see whether a solution is waiting to be judged or has a result.',
            'My submissions shows whether a solution is being judged or has a result.',
          ],
        },
        technicalPhrases: {
          vi: [
            'PENDING là chờ xử lý, QUEUED là đang chờ trong hàng đợi, RUNNING là đang chấm.',
            'PENDING nghĩa là chờ xử lý; QUEUED là đang chờ và RUNNING là đang chấm.',
          ],
          en: [
            'PENDING means waiting for processing, QUEUED means waiting in the queue, and RUNNING means judging is in progress.',
            'PENDING is waiting for processing, QUEUED is waiting in the queue, and RUNNING is being judged.',
          ],
        },
      },
      {
        id: 'submission-verdicts',
        phrases: {
          vi: [
            'Nếu bài làm chưa được chấp nhận, hãy đọc thông báo kết quả và chỉnh sửa mã nguồn nếu cần.',
            'Nếu bài làm chưa được chấp nhận, hãy đọc thông báo kết quả, chỉnh sửa mã nguồn nếu cần rồi chọn Gửi bài giải để nộp lại.',
            'Kết quả chấm sẽ giúp bạn biết cần kiểm tra lại phần nào trong bài làm.',
          ],
          en: [
            'If your solution is not accepted, review the result and make any needed changes to your code.',
            'If your solution is not accepted, review the result, make any needed changes, and choose Submit solution to try again.',
            'The judging result can help you understand what to check in your solution.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Các kết quả gồm ACCEPTED (đạt), WRONG_ANSWER (sai kết quả), TIME_LIMIT_EXCEEDED (vượt giới hạn thời gian), MEMORY_LIMIT_EXCEEDED (vượt giới hạn bộ nhớ), RUNTIME_ERROR (lỗi khi chạy), COMPILATION_ERROR (lỗi biên dịch) và INTERNAL_ERROR (lỗi hệ thống).',
            'Các kết quả cuối gồm ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, RUNTIME_ERROR, COMPILATION_ERROR và INTERNAL_ERROR.',
          ],
          en: [
            'Final verdicts include ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, RUNTIME_ERROR, COMPILATION_ERROR, and INTERNAL_ERROR.',
            'The verdicts are ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, RUNTIME_ERROR, COMPILATION_ERROR, and INTERNAL_ERROR.',
          ],
        },
      },
      {
        id: 'submission-details-route',
        phrases: {
          vi: [
            'Mở Bài nộp của tôi trong trang bài tập để xem các chi tiết kết quả chấm.',
            'Chọn Bài nộp của tôi trên trang bài tập để xem kết quả của từng lần nộp.',
          ],
          en: [
            'Open My submissions on the problem page to view the judging details.',
            'Choose My submissions on a problem page to view the result of each attempt.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Mở chi tiết bài nộp của bạn tại /submissions/:submissionId để xem kết quả được phép hiển thị.',
            'Xem kết quả được phép hiển thị trong chi tiết bài nộp tại /submissions/:submissionId.',
          ],
          en: [
            'Open your submission details at /submissions/:submissionId to view the results available to you.',
            'View the available results in your submission details at /submissions/:submissionId.',
          ],
        },
      },
      ...[
        [
          'pending',
          'PENDING',
          'Bài nộp đang chờ được xử lý.',
          'Your submission is waiting to be processed.',
        ],
        [
          'queued',
          'QUEUED',
          'Bài nộp đang chờ đến lượt được chấm.',
          'Your submission is waiting in the judging queue.',
        ],
        [
          'running',
          'RUNNING',
          'Hệ thống đang chấm bài nộp của bạn.',
          'The system is judging your submission.',
        ],
        [
          'accepted',
          'ACCEPTED',
          'Bài làm đã được chấp nhận.',
          'Your solution has been accepted.',
        ],
        [
          'wrong-answer',
          'WRONG_ANSWER',
          'Kết quả của bài làm chưa chính xác.',
          'Your solution produced an incorrect answer.',
        ],
        [
          'time-limit-exceeded',
          'TIME_LIMIT_EXCEEDED',
          'Chương trình chạy quá thời gian cho phép.',
          'Your program exceeded the time limit.',
        ],
        [
          'memory-limit-exceeded',
          'MEMORY_LIMIT_EXCEEDED',
          'Chương trình dùng quá giới hạn bộ nhớ.',
          'Your program exceeded the memory limit.',
        ],
        [
          'runtime-error',
          'RUNTIME_ERROR',
          'Chương trình gặp lỗi khi chạy.',
          'Your program encountered an error while running.',
        ],
        [
          'compilation-error',
          'COMPILATION_ERROR',
          'Mã nguồn gặp lỗi biên dịch.',
          'Your code could not be compiled.',
        ],
        [
          'internal-error',
          'INTERNAL_ERROR',
          'Đã xảy ra lỗi trong quá trình chấm bài.',
          'An internal error occurred while judging the submission.',
        ],
      ].map(([id, code, vi, en]) => ({
        id: `status-${id}`,
        phrases: {
          vi: [vi],
          en: [en],
        },
        technicalPhrases: {
          vi: [`${code} nghĩa là: ${vi.toLocaleLowerCase('vi')}`],
          en: [`${code} means: ${en.toLocaleLowerCase('en')}`],
        },
      })),
    ],
    sources: [
      'backend/src/submissions/dto/problem-submissions.dto.ts:7-18',
      'backend/src/judging/judging.repository.ts:70-95,440-501',
      'backend/src/judge0/judge0.types.ts:18-38',
      'frontend/src/features/submissions/data/submission-verdicts.ts:1-24',
    ],
    allowedRoutes: ['/submissions/:submissionId'],
  },
  {
    id: 'contests',
    topic: 'contests',
    question: {
      vi: 'Tôi tìm và đăng ký tham gia cuộc thi như thế nào?',
      en: 'How do I find and register for a contest?',
    },
    answer: {
      vi: 'Chọn Cuộc thi trên thanh menu để xem danh sách cuộc thi công khai. Bạn cần đăng nhập và đăng ký trước khi cuộc thi bắt đầu hoặc đóng đăng ký.',
      en: 'Choose Contests from the navigation menu to browse public contests. You need to sign in and register before the contest starts or registration closes.',
    },
    technicalAnswer: {
      vi: 'Mở /contests để xem các cuộc thi công khai đã xuất bản. Bạn cần đăng nhập và đăng ký trước khi cuộc thi bắt đầu hoặc đóng đăng ký.',
      en: 'Open /contests to browse published public contests. You need to sign in and register before the contest starts or registration closes.',
    },
    approvedStatements: [
      {
        id: 'published-contests',
        phrases: {
          vi: [
            'Chọn Cuộc thi trên thanh menu để xem danh sách cuộc thi công khai.',
            'Mục Cuộc thi trên thanh menu hiển thị các cuộc thi công khai.',
          ],
          en: [
            'Choose Contests from the navigation menu to browse public contests.',
            'The Contests item in the navigation menu lists public contests.',
          ],
        },
        technicalPhrases: {
          vi: ['Mở /contests để xem các cuộc thi công khai đã xuất bản.'],
          en: ['Open /contests to browse published public contests.'],
        },
      },
      {
        id: 'contest-registration-conditions',
        phrases: {
          vi: [
            'Bạn cần đăng nhập và đăng ký trước khi cuộc thi bắt đầu hoặc đóng đăng ký.',
            'Không thể đăng ký sau khi cuộc thi bắt đầu hoặc đã đóng đăng ký.',
          ],
          en: [
            'You need to sign in and register before the contest starts or registration closes.',
            'Registration is unavailable after a contest starts or registration closes.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:125-126',
      'backend/src/contests/student-contests.controller.ts:60-89,158-175',
    ],
    allowedRoutes: ['/contests'],
  },
  {
    id: 'global-leaderboard',
    topic: 'leaderboard',
    question: {
      vi: 'Tôi xem bảng xếp hạng tổng thể ở đâu?',
      en: 'Where can I view the global leaderboard?',
    },
    answer: {
      vi: 'Chọn Bảng xếp hạng trên thanh menu để xem thứ hạng chung.',
      en: 'Choose Leaderboard from the navigation menu to view the overall rankings.',
    },
    technicalAnswer: {
      vi: 'Bảng xếp hạng tổng thể có tại /leaderboard.',
      en: 'The global leaderboard is at /leaderboard.',
    },
    approvedStatements: [
      {
        id: 'global-leaderboard-route',
        phrases: {
          vi: [
            'Chọn Bảng xếp hạng trên thanh menu để xem thứ hạng chung.',
            'Mục Bảng xếp hạng trên thanh menu hiển thị thứ hạng chung.',
          ],
          en: [
            'Choose Leaderboard from the navigation menu to view the overall rankings.',
            'The Leaderboard item in the navigation menu shows the overall rankings.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Mở /leaderboard để xem bảng xếp hạng tổng thể.',
            'Bảng xếp hạng tổng thể có tại /leaderboard.',
          ],
          en: [
            'Open /leaderboard to view the global leaderboard.',
            'The global leaderboard is at /leaderboard.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:158',
      'backend/src/leaderboard/leaderboard.controller.ts:11-21',
    ],
    allowedRoutes: ['/leaderboard'],
  },
  {
    id: 'organizations',
    topic: 'organizations',
    question: {
      vi: 'Tôi xem hoặc tham gia tổ chức như thế nào?',
      en: 'How do I browse or join an organization?',
    },
    answer: {
      vi: 'Chọn Tổ chức trên thanh menu và mở một tổ chức đang hoạt động để xem thông tin. Để tham gia, đăng nhập rồi chọn Tham gia tổ chức. Nội dung bạn xem được phụ thuộc vào quyền của tài khoản và tổ chức.',
      en: 'Choose Organizations from the navigation menu and open an active organization to see its details. To join, sign in and choose Join organization. Available content depends on the organization and your account permissions.',
    },
    technicalAnswer: {
      vi: 'Mở /organizations để xem danh sách tổ chức ACTIVE. Tham gia tổ chức ACTIVE yêu cầu đăng nhập. Nội dung bạn xem được phụ thuộc vào quyền của tài khoản và tổ chức.',
      en: 'Open /organizations to browse ACTIVE organizations. Joining an ACTIVE organization requires sign-in. Available content depends on the organization and your account permissions.',
    },
    approvedStatements: [
      {
        id: 'active-organization-list',
        phrases: {
          vi: [
            'Chọn Tổ chức trên thanh menu và mở một tổ chức đang hoạt động để xem thông tin.',
            'Mục Tổ chức trên thanh menu hiển thị các tổ chức đang hoạt động.',
          ],
          en: [
            'Choose Organizations from the navigation menu and open an active organization to see its details.',
            'The Organizations item in the navigation menu lists active organizations.',
          ],
        },
        technicalPhrases: {
          vi: ['Mở /organizations để xem danh sách tổ chức ACTIVE.'],
          en: ['Open /organizations to browse ACTIVE organizations.'],
        },
      },
      {
        id: 'organization-join-requirements',
        phrases: {
          vi: [
            'Để tham gia, đăng nhập rồi chọn Tham gia tổ chức.',
            'Bạn cần đăng nhập trước khi chọn Tham gia tổ chức.',
          ],
          en: [
            'To join, sign in and choose Join organization.',
            'You need to sign in before choosing Join organization.',
          ],
        },
        technicalPhrases: {
          vi: ['Tham gia tổ chức ACTIVE yêu cầu đăng nhập.'],
          en: ['Joining an ACTIVE organization requires sign-in.'],
        },
      },
      {
        id: 'organization-permission-variation',
        phrases: {
          vi: [
            'Nội dung bạn xem được phụ thuộc vào quyền của tài khoản và tổ chức.',
            'Thông tin hiển thị có thể khác nhau tùy theo tổ chức và quyền của bạn.',
          ],
          en: [
            'Available content depends on the organization and your account permissions.',
            'What you can view depends on the organization and your account permissions.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:132,147-152',
      'backend/src/organizations/organizations.controller.ts:174-246',
    ],
    allowedRoutes: ['/organizations', '/organizations/:organizationId'],
  },
  {
    id: 'discussions-comments',
    topic: 'discussions',
    question: {
      vi: 'Tôi xem thảo luận và bình luận, hoặc đăng bình luận ở đâu?',
      en: 'Where can I read discussions and comments or post a comment?',
    },
    answer: {
      vi: 'Mở trang Thảo luận để đọc các chủ đề và bình luận. Bạn có thể đọc công khai; cần đăng nhập để tạo chủ đề hoặc gửi bình luận. Bình luận của từng bài nằm trên trang bài tập tương ứng.',
      en: 'Open Discussions to read topics and comments. You can read them publicly; sign in to create a topic or post a comment. Each problem’s comments are on its problem page.',
    },
    technicalAnswer: {
      vi: 'Mở /discussions để xem các chủ đề thảo luận. Bình luận của bài tập nằm tại /problems/:code/comments. Đăng nhập để tạo chủ đề mới hoặc gửi bình luận.',
      en: 'Open /discussions to browse topics. Problem comments are at /problems/:code/comments. Sign in to create a new topic or post a comment.',
    },
    approvedStatements: [
      {
        id: 'discussion-list',
        phrases: {
          vi: [
            'Mở trang Thảo luận để đọc các chủ đề và bình luận.',
            'Trang Thảo luận hiển thị các chủ đề để bạn theo dõi.',
          ],
          en: [
            'Open Discussions to read topics and comments.',
            'The Discussions page lets you browse topics.',
          ],
        },
        technicalPhrases: {
          vi: ['Mở /discussions để xem các chủ đề thảo luận.'],
          en: ['Open /discussions to browse topics.'],
        },
      },
      {
        id: 'discussion-access',
        phrases: {
          vi: [
            'Bạn có thể đọc công khai; cần đăng nhập để tạo chủ đề hoặc gửi bình luận.',
            'Đăng nhập để tạo chủ đề mới hoặc gửi bình luận.',
          ],
          en: [
            'You can read them publicly; sign in to create a topic or post a comment.',
            'Sign in to create a new topic or post a comment.',
          ],
        },
      },
      {
        id: 'problem-comments-route',
        phrases: {
          vi: [
            'Bình luận của từng bài nằm trên trang bài tập tương ứng.',
            'Mở bài tập tương ứng để xem phần bình luận.',
          ],
          en: [
            'Each problem’s comments are on its problem page.',
            'Open the relevant problem to view its comments.',
          ],
        },
        technicalPhrases: {
          vi: ['Bình luận của bài tập nằm tại /problems/:code/comments.'],
          en: ['Problem comments are at /problems/:code/comments.'],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:162-164',
      'backend/src/community/discussions.controller.ts:46-110',
      'backend/src/community/problem-comments.controller.ts:34-62',
    ],
    allowedRoutes: [
      '/discussions',
      '/discussions/:id',
      '/problems/:code/comments',
    ],
  },
  {
    id: 'notifications',
    topic: 'notifications',
    question: {
      vi: 'Tôi xem và đánh dấu thông báo đã đọc ở đâu?',
      en: 'Where can I view notifications and mark them as read?',
    },
    answer: {
      vi: 'Đăng nhập rồi chọn biểu tượng chuông trên thanh đầu trang để xem thông báo. Bạn có thể mở từng thông báo hoặc đánh dấu một hay tất cả là đã đọc.',
      en: 'Sign in and choose the bell icon in the top bar to view your notifications. You can open a notification, mark one as read, or mark all as read.',
    },
    approvedStatements: [
      {
        id: 'notification-list',
        phrases: {
          vi: [
            'Đăng nhập rồi chọn biểu tượng chuông trên thanh đầu trang để xem thông báo.',
            'Chọn biểu tượng chuông ở thanh đầu trang để mở thông báo của bạn.',
          ],
          en: [
            'Sign in and choose the bell icon in the top bar to view your notifications.',
            'Choose the bell icon in the top bar to open your notifications.',
          ],
        },
      },
      {
        id: 'notification-actions',
        phrases: {
          vi: [
            'Bạn có thể mở từng thông báo hoặc đánh dấu một hay tất cả là đã đọc.',
            'Mở thông báo hoặc chọn đánh dấu đã đọc cho một thông báo hay tất cả.',
          ],
          en: [
            'You can open a notification, mark one as read, or mark all as read.',
            'Notifications can be opened individually, marked read one at a time, or all marked as read.',
          ],
        },
      },
      {
        id: 'notification-sign-in',
        phrases: {
          vi: [
            'Chức năng yêu cầu đăng nhập.',
            'Bạn cần đăng nhập để dùng chức năng thông báo.',
          ],
          en: [
            'Sign-in is required.',
            'You need to sign in to use notifications.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/components/layout/SiteHeader.tsx:1-12',
      'frontend/src/components/layout/notifications/NotificationBell.tsx:216-320',
      'backend/src/contact/contact.controller.ts:184-218',
    ],
    allowedRoutes: [],
  },
  {
    id: 'oauth-sign-in',
    topic: 'account',
    question: {
      vi: 'Tôi đăng nhập hoặc đăng ký bằng Google hay GitHub như thế nào?',
      en: 'How do I sign in or register with Google or GitHub?',
    },
    answer: {
      vi: 'Trên trang Đăng nhập, chọn Google hoặc GitHub để tiếp tục. Trên trang Đăng ký, chọn Google hoặc GitHub để tạo tài khoản.',
      en: 'On the Sign in page, choose Google or GitHub to continue. On the Register page, choose Google or GitHub to create an account.',
    },
    technicalAnswer: {
      vi: 'Tại /login, chọn Google hoặc GitHub để đăng nhập. Để đăng ký bằng Google hoặc GitHub, mở /register và chọn nút tương ứng.',
      en: 'At /login, choose Google or GitHub to sign in. To register with Google or GitHub, open /register and choose the matching button.',
    },
    approvedStatements: [
      {
        id: 'oauth-sign-in',
        phrases: {
          vi: [
            'Trên trang Đăng nhập, chọn Google hoặc GitHub để tiếp tục.',
            'Chọn nút Google hoặc GitHub ở trang Đăng nhập.',
          ],
          en: [
            'On the Sign in page, choose Google or GitHub to continue.',
            'Choose the Google or GitHub button on the Sign in page.',
          ],
        },
        technicalPhrases: {
          vi: ['Tại /login, chọn Google hoặc GitHub để đăng nhập.'],
          en: ['At /login, choose Google or GitHub to sign in.'],
        },
      },
      {
        id: 'oauth-register',
        phrases: {
          vi: [
            'Trên trang Đăng ký, chọn Google hoặc GitHub để tạo tài khoản.',
            'Chọn nút Google hoặc GitHub trên trang Đăng ký để tiếp tục.',
          ],
          en: [
            'On the Register page, choose Google or GitHub to create an account.',
            'Choose the Google or GitHub button on the Register page to continue.',
          ],
        },
        technicalPhrases: {
          vi: [
            'Để đăng ký bằng Google hoặc GitHub, mở /register và chọn nút tương ứng.',
          ],
          en: [
            'To register with Google or GitHub, open /register and choose the matching button.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:92-93',
      'frontend/src/features/auth/pages/AuthPage.tsx:393-512',
      'frontend/src/features/auth/api.ts:105-119',
      'backend/src/auth/auth.controller.ts:200-218,289-307',
    ],
    allowedRoutes: ['/login', '/register'],
  },
  {
    id: 'password-change',
    topic: 'account',
    question: {
      vi: 'Tôi đổi hoặc thiết lập mật khẩu trong tài khoản như thế nào?',
      en: 'How do I change or set up a password for my account?',
    },
    answer: {
      vi: 'Khi đã đăng nhập, mở menu tài khoản trên thanh đầu trang và chọn Đổi mật khẩu. Nếu tài khoản chưa có mật khẩu, biểu mẫu sẽ hướng dẫn bạn thiết lập một mật khẩu.',
      en: 'When signed in, open the account menu in the top bar and choose Change password. If the account does not have a password yet, the form guides you through setting one up.',
    },
    approvedStatements: [
      {
        id: 'password-change-entry',
        phrases: {
          vi: [
            'Khi đã đăng nhập, mở menu tài khoản trên thanh đầu trang và chọn Đổi mật khẩu.',
            'Chọn Đổi mật khẩu trong menu tài khoản ở thanh đầu trang.',
          ],
          en: [
            'When signed in, open the account menu in the top bar and choose Change password.',
            'Choose Change password from the account menu in the top bar.',
          ],
        },
      },
      {
        id: 'password-setup-flow',
        phrases: {
          vi: [
            'Nếu tài khoản chưa có mật khẩu, biểu mẫu sẽ hướng dẫn bạn thiết lập một mật khẩu.',
            'Tài khoản chưa có mật khẩu sẽ được hướng dẫn thiết lập mật khẩu trong biểu mẫu.',
          ],
          en: [
            'If the account does not have a password yet, the form guides you through setting one up.',
            'The form guides accounts without a password through setting one up.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/components/layout/SiteHeader.tsx:226-248,301-305',
      'frontend/src/components/layout/ChangePasswordDialog.tsx:359-464',
      'backend/src/auth/auth.controller.ts:443-464',
    ],
    allowedRoutes: [],
  },
  {
    id: 'problem-editorial',
    topic: 'problems',
    question: {
      vi: 'Tôi xem và mở khóa lời giải bài tập ở đâu?',
      en: 'Where can I view or unlock a problem editorial?',
    },
    answer: {
      vi: 'Trên trang bài tập, chọn Xem lời giải để xem lời giải đã công bố. Để mở khóa, bạn cần đăng nhập, nộp bài và nhận ít nhất một kết quả chấm cuối cùng. Trang chỉ hiển thị những lời giải đã được công bố.',
      en: 'On the problem page, choose View solution to see published editorials. To unlock editorials, sign in, submit a solution, and receive at least one final judging result. Only published editorials are shown.',
    },
    technicalAnswer: {
      vi: 'Mở /problems/:code/solution để xem lời giải đã công bố. Để mở khóa, bạn cần đăng nhập, nộp bài và nhận ít nhất một kết quả chấm cuối cùng.',
      en: 'Open /problems/:code/solution to view published editorials. To unlock editorials, sign in, submit a solution, and receive at least one final judging result.',
    },
    approvedStatements: [
      {
        id: 'problem-editorial-route',
        phrases: {
          vi: [
            'Trên trang bài tập, chọn Xem lời giải để xem lời giải đã công bố.',
            'Chọn Xem lời giải trên trang bài tập để mở lời giải đã công bố.',
          ],
          en: [
            'On the problem page, choose View solution to see published editorials.',
            'Choose View solution on the problem page to open published editorials.',
          ],
        },
        technicalPhrases: {
          vi: ['Mở /problems/:code/solution để xem lời giải đã công bố.'],
          en: ['Open /problems/:code/solution to view published editorials.'],
        },
      },
      {
        id: 'problem-editorial-unlock',
        phrases: {
          vi: [
            'Để mở khóa, bạn cần đăng nhập, nộp bài và nhận ít nhất một kết quả chấm cuối cùng.',
            'Bạn cần đăng nhập và nộp bài để nhận kết quả chấm, sau đó mới mở khóa được lời giải.',
          ],
          en: [
            'To unlock editorials, sign in, submit a solution, and receive at least one final judging result.',
            'Sign in and submit a solution; the editorial unlocks after you receive a final judging result.',
          ],
        },
      },
      {
        id: 'published-editorials-only',
        phrases: {
          vi: [
            'Trang chỉ hiển thị những lời giải đã được công bố.',
            'Chỉ những lời giải đã xuất bản mới xuất hiện trên trang.',
          ],
          en: [
            'Only published editorials are shown.',
            'The page displays published editorials only.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:122-124',
      'frontend/src/features/problems/pages/ProblemSolutionPage.tsx:41-96',
      'backend/src/problems/problems.controller.ts:58-67',
      'backend/src/problems/problems.service.ts:30-45',
    ],
    allowedRoutes: ['/problems/:code/solution'],
  },
  {
    id: 'contest-leaderboard',
    topic: 'contests',
    question: {
      vi: 'Tôi xem bảng xếp hạng của một cuộc thi ở đâu?',
      en: 'Where can I view a contest leaderboard?',
    },
    answer: {
      vi: 'Mở cuộc thi rồi chọn tab Bảng xếp hạng. Bảng chỉ xem được khi cuộc thi công khai và tính năng bảng xếp hạng được bật.',
      en: 'Open the contest and choose its Leaderboard tab. It is available only when the contest is public and its leaderboard is enabled.',
    },
    technicalAnswer: {
      vi: 'Mở /contests, chọn cuộc thi rồi chọn tab “Bảng xếp hạng”. Bảng chỉ xem được khi cuộc thi công khai và tính năng bảng xếp hạng được bật.',
      en: 'Open /contests, choose a contest, and select the “Leaderboard” tab. It is available only when the contest is public and its leaderboard is enabled.',
    },
    approvedStatements: [
      {
        id: 'contest-leaderboard-navigation',
        phrases: {
          vi: [
            'Mở cuộc thi rồi chọn tab Bảng xếp hạng.',
            'Trong trang cuộc thi, chọn tab Bảng xếp hạng.',
          ],
          en: [
            'Open the contest and choose its Leaderboard tab.',
            'Choose the Leaderboard tab on the contest page.',
          ],
        },
        technicalPhrases: {
          vi: ['Mở /contests, chọn cuộc thi rồi chọn tab “Bảng xếp hạng”.'],
          en: [
            'Open /contests, choose a contest, and select the “Leaderboard” tab.',
          ],
        },
      },
      {
        id: 'contest-leaderboard-availability',
        phrases: {
          vi: [
            'Bảng chỉ xem được khi cuộc thi công khai và tính năng bảng xếp hạng được bật.',
            'Bảng xếp hạng chỉ khả dụng nếu cuộc thi công khai và bảng được bật.',
          ],
          en: [
            'It is available only when the contest is public and its leaderboard is enabled.',
            'The leaderboard is available only for a public contest with the feature enabled.',
          ],
        },
      },
    ],
    sources: [
      'frontend/src/App.tsx:125-126',
      'frontend/src/features/contests/pages/ContestDetailPage.tsx:35-42,460-470',
      'backend/src/contests/student-contests.controller.ts:104-118',
    ],
    allowedRoutes: ['/contests', '/contests/:contestId'],
  },
];

export const AI_ASSISTANT_GLOSSARY: readonly AiAssistantGlossaryEntry[] = [
  {
    id: 'AC',
    faqId: 'submission-statuses',
    statementId: 'status-accepted',
    aliases: ['AC', 'Accepted', 'ACCEPTED'],
    phrases: {
      vi: 'AC là viết tắt của Accepted, nghĩa là bài làm đã được chấp nhận.',
      en: 'AC stands for Accepted, meaning the solution has been accepted.',
    },
  },
  {
    id: 'WA',
    faqId: 'submission-statuses',
    statementId: 'status-wrong-answer',
    aliases: ['WA', 'Wrong Answer', 'WRONG_ANSWER'],
    phrases: {
      vi: 'WA là viết tắt của Wrong Answer, nghĩa là kết quả bài làm chưa chính xác.',
      en: 'WA stands for Wrong Answer, meaning the solution produced an incorrect answer.',
    },
  },
  {
    id: 'TLE',
    faqId: 'submission-statuses',
    statementId: 'status-time-limit-exceeded',
    aliases: ['TLE', 'Time Limit Exceeded', 'TIME_LIMIT_EXCEEDED'],
    phrases: {
      vi: 'TLE là viết tắt của Time Limit Exceeded, nghĩa là chương trình chạy quá thời gian cho phép.',
      en: 'TLE stands for Time Limit Exceeded, meaning the program exceeded the time limit.',
    },
  },
  {
    id: 'MLE',
    faqId: 'submission-statuses',
    statementId: 'status-memory-limit-exceeded',
    aliases: ['MLE', 'Memory Limit Exceeded', 'MEMORY_LIMIT_EXCEEDED'],
    phrases: {
      vi: 'MLE là viết tắt của Memory Limit Exceeded, nghĩa là chương trình dùng quá giới hạn bộ nhớ.',
      en: 'MLE stands for Memory Limit Exceeded, meaning the program exceeded the memory limit.',
    },
  },
  {
    id: 'RE',
    faqId: 'submission-statuses',
    statementId: 'status-runtime-error',
    aliases: ['RE', 'Runtime Error', 'RUNTIME_ERROR'],
    phrases: {
      vi: 'RE là viết tắt của Runtime Error, nghĩa là chương trình gặp lỗi khi chạy.',
      en: 'RE stands for Runtime Error, meaning the program encountered an error while running.',
    },
  },
  {
    id: 'CE',
    faqId: 'submission-statuses',
    statementId: 'status-compilation-error',
    aliases: ['CE', 'Compilation Error', 'COMPILATION_ERROR'],
    phrases: {
      vi: 'CE là viết tắt của Compilation Error, nghĩa là mã nguồn gặp lỗi biên dịch.',
      en: 'CE stands for Compilation Error, meaning the code could not be compiled.',
    },
  },
];

function getTokens(value: string): string[] {
  return (
    value
      .normalize('NFKC')
      .toLocaleLowerCase()
      .match(/[\p{Letter}\p{Number}]+/gu) ?? []
  );
}

export function findAiAssistantGlossaryMatches(
  question: string,
): AiAssistantGlossaryEntry[] {
  const questionTokens = getTokens(question);
  return AI_ASSISTANT_GLOSSARY.filter((entry) =>
    entry.aliases.some((alias) => {
      const aliasTokens = getTokens(alias);
      return (
        aliasTokens.length > 0 &&
        questionTokens.some((_, index) =>
          aliasTokens.every((token, offset) => questionTokens[index + offset] === token),
        )
      );
    }),
  );
}
