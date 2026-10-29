import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from './login.dto.js';
import { ProfileUpdateDto } from './profile-update.dto.js';
import { RegisterDto } from './register.dto.js';

describe('authentication DTO validation', () => {
  it('accepts a valid email, username, and password', () => {
    const dto = plainToInstance(RegisterDto, {
      username: 'student_01',
      email: 'student@example.com',
      password: 'long-enough-password',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects short usernames, malformed emails, short passwords, and @ usernames', () => {
    const dto = plainToInstance(RegisterDto, {
      username: 'student@example.com',
      email: 'not-an-email',
      password: 'short',
    });

    expect(validateSync(dto).length).toBeGreaterThanOrEqual(3);
  });

  it('accepts either username or email as a login identifier', () => {
    for (const identifier of ['student01', 'student@example.com']) {
      const dto = plainToInstance(LoginDto, { identifier, password: 'password' });
      expect(validateSync(dto)).toHaveLength(0);
    }
  });

  it('validates profile update fields', () => {
    const valid = plainToInstance(ProfileUpdateDto, {
      fullName: 'Student Name',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(validateSync(valid)).toHaveLength(0);

    const invalid = plainToInstance(ProfileUpdateDto, {
      avatarUrl: 'javascript:alert(1)',
    });
    expect(validateSync(invalid).length).toBeGreaterThan(0);
  });
});
