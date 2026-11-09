import { describe, expect, it } from 'vitest';
import { assertCanAddMember, assertCanChangeRole, assertCanRemoveMember } from './organization-member-policy.js';

const sys = { isSystemAdmin: true, role: null } as const;
const owner = { isSystemAdmin: false, role: 'OWNER' } as const;
const admin = { isSystemAdmin: false, role: 'ADMIN' } as const;
const member = { isSystemAdmin: false, role: 'MEMBER' } as const;
const outsider = { isSystemAdmin: false, role: null } as const;

describe('organization member policy', () => {
  it('thêm thành viên', () => {
    expect(() => assertCanAddMember(sys, 'ADMIN')).not.toThrow();
    expect(() => assertCanAddMember(owner, 'ADMIN')).not.toThrow();
    expect(() => assertCanAddMember(admin, 'MEMBER')).not.toThrow();
    expect(() => assertCanAddMember(admin, 'ADMIN')).toThrow();
    expect(() => assertCanAddMember(member, 'MEMBER')).toThrow();
    expect(() => assertCanAddMember(outsider, 'MEMBER')).toThrow();
  });

  it('đổi vai trò', () => {
    expect(() => assertCanChangeRole(owner, 'MEMBER')).not.toThrow();
    expect(() => assertCanChangeRole(sys, 'ADMIN')).not.toThrow();
    expect(() => assertCanChangeRole(admin, 'MEMBER')).toThrow();
    expect(() => assertCanChangeRole(owner, 'OWNER')).toThrow();
    expect(() => assertCanChangeRole(sys, 'OWNER')).toThrow();
  });

  it('xóa thành viên', () => {
    expect(() => assertCanRemoveMember(owner, 'ADMIN')).not.toThrow();
    expect(() => assertCanRemoveMember(sys, 'MEMBER')).not.toThrow();
    expect(() => assertCanRemoveMember(admin, 'MEMBER')).not.toThrow();
    expect(() => assertCanRemoveMember(admin, 'ADMIN')).toThrow();
    expect(() => assertCanRemoveMember(admin, 'OWNER')).toThrow();
    expect(() => assertCanRemoveMember(member, 'MEMBER')).toThrow();
    expect(() => assertCanRemoveMember(sys, 'OWNER')).toThrow();
  });
});
