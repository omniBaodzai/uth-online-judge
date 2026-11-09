import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository.js';
import { OrganizationsService } from './organizations.service.js';

// Chạy với một Postgres tạm đã áp dụng migrations 001–024. Không bao giờ trỏ vào DB thật.
const url = process.env.ORG_TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run('Organizations (Postgres thật)', () => {
  let pool: Pool;
  let repo: OrganizationsRepository;
  let service: OrganizationsService;
  const ids: Record<string, string> = {};

  const makeUser = async (name: string, role = 'STUDENT', active = true) => {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO public.users (username, email, password_hash, role, is_active, full_name)
       VALUES ($1, $2, 'x', $3, $4, $1) RETURNING id`,
      [name, `${name}@t.test`, role, active],
    );
    ids[name] = result.rows[0]!.id;
  };
  const request = (n: number) => ({
    fullName: `Tên ${n}`, workplace: `Đơn vị ${n}`, position: 'GV', phoneNumber: '0901234567', motivation: 'Cần tổ chức',
  });
  const ownerRows = (orgId: string) =>
    pool.query(`SELECT user_id, role FROM public.organization_members WHERE organization_id=$1 ORDER BY role`, [orgId]);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    repo = new OrganizationsRepository(pool);
    service = new OrganizationsService(repo);
    for (const name of ['adm', 'alice', 'bob', 'carol']) await makeUser(name, name === 'adm' ? 'ADMIN' : 'STUDENT');
    await makeUser('gone', 'STUDENT', false);
  });
  afterAll(async () => pool.end());

  it('chỉ cho một PENDING mỗi người, REJECTED được gửi lại', async () => {
    const first = await service.createRequest(ids.alice!, request(1));
    expect(first.status).toBe('PENDING');
    await expect(service.createRequest(ids.alice!, request(2))).rejects.toBeInstanceOf(ConflictException);
    const rejected = await service.rejectRequest(first.id, ids.adm!, 'không đủ thông tin');
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'không đủ thông tin',
      reviewer: { username: 'adm' },
    });
    expect(rejected.reviewedAt).toBeTruthy();
    expect(await service.getAdminRequest(first.id)).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'không đủ thông tin',
    });
    await expect(service.rejectRequest(first.id, ids.adm!, null)).rejects.toBeInstanceOf(ConflictException);
    const again = await service.createRequest(ids.alice!, request(3));
    expect(again.status).toBe('PENDING');
    // không tạo membership/tổ chức khi gửi yêu cầu
    expect((await pool.query(`SELECT 1 FROM public.organizations`)).rowCount).toBe(0);
  });

  it('APPROVE tạo tổ chức + OWNER khác requester; duyệt lần hai trả 409', async () => {
    const [pending] = (await service.listAdminRequests({ page: 1, pageSize: 10, sort: 'newest', status: 'PENDING' })).items;
    const approved = await service.approveRequest(pending!.id, ids.adm!, {
      name: 'Khoa CNTT', slug: 'khoa-cntt', ownerIdentifier: 'BOB',
    });
    expect(approved.status).toBe('APPROVED');
    const org = approved.createdOrganization!;
    expect(approved.requester?.username).toBe('alice');
    expect(approved.requester?.email).toBe('alice@t.test');
    expect(approved.reviewer?.username).toBe('adm');
    expect(approved.reviewedAt).toBeTruthy();
    expect(approved.createdOrganizationDetails).toMatchObject({
      id: org.id,
      slug: 'khoa-cntt',
      name: 'Khoa CNTT',
      status: 'ACTIVE',
      owner: { id: ids.bob, username: 'bob' },
    });
    expect(await service.getAdminRequest(pending!.id)).toMatchObject({
      status: 'APPROVED',
      createdOrganizationDetails: { id: org.id, owner: { username: 'bob' } },
    });
    expect((await service.getAdminOrganization(approved.createdOrganization!.id)).sourceRequestId).toBe(pending!.id);
    expect((await ownerRows(org.id)).rows).toEqual([{ user_id: ids.bob, role: 'OWNER' }]);
    await expect(service.approveRequest(pending!.id, ids.adm!, { name: 'Khác' })).rejects.    toBeInstanceOf(ConflictException);
    expect((await pool.query(`SELECT 1 FROM public.organizations`)).rowCount).toBe(1);
  });

  it('APPROVE đồng thời chỉ tạo một tổ chức', async () => {
    const req = await service.createRequest(ids.carol!, request(4));
    const results = await Promise.allSettled([
      service.approveRequest(req.id, ids.adm!, { name: 'Song song A', slug: 'song-song-a' }),
      service.approveRequest(req.id, ids.adm!, { name: 'Song song B', slug: 'song-song-b' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await pool.query(`SELECT 1 FROM public.organizations WHERE slug LIKE 'song-song-%'`)).rowCount).toBe(1);
  });

  it('rollback khi OWNER không hợp lệ: request vẫn PENDING, không có tổ chức mồ côi', async () => {
    const req = await service.createRequest(ids.bob!, request(5));
    await expect(
      service.approveRequest(req.id, ids.adm!, { name: 'X', slug: 'rollback-x', ownerIdentifier: 'gone' }),
    ).rejects.toThrow();
    await expect(
      service.approveRequest(req.id, ids.adm!, { name: 'Y', slug: 'khoa-cntt' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await service.getAdminRequest(req.id)).status).toBe('PENDING');
    expect((await pool.query(`SELECT 1 FROM public.organizations WHERE slug='rollback-x'`)).rowCount).toBe(0);
  });

  it('tạo tổ chức không OWNER / có OWNER là Admin; slug trùng 409', async () => {
    const noOwner = await service.createOrganization({ name: 'Không owner', slug: 'khong-owner' });
    expect(noOwner.owner).toBeNull();
    const adminOwned = await service.createOrganization({ name: 'Admin owner', ownerIdentifier: 'adm' });
    expect(adminOwned.slug).toBe('admin-owner');
    expect(adminOwned.owner?.id).toBe(ids.adm);
    await expect(service.createOrganization({ name: 'Trùng', slug: 'khong-owner' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('chuyển / gỡ / gán OWNER giữ nhất quán', async () => {
    const org = await service.createOrganization({ name: 'Chuyển owner', slug: 'chuyen-owner', ownerIdentifier: 'alice' });
    let result = await service.changeOwner(org.id, 'bob', 'ADMIN');
    expect(result.owner?.id).toBe(ids.bob);
    expect((await ownerRows(org.id)).rows).toEqual([
      { user_id: ids.alice, role: 'ADMIN' }, { user_id: ids.bob, role: 'OWNER' },
    ].sort((a, b) => a.role.localeCompare(b.role)));
    result = await service.changeOwner(org.id, null, 'ADMIN');
    expect(result.owner).toBeNull();
    expect((await pool.query(`SELECT 1 FROM public.organization_members WHERE organization_id=$1 AND role='OWNER'`, [org.id])).rowCount).toBe(0);
    result = await service.changeOwner(org.id, 'alice', 'MEMBER');
    expect(result.owner?.id).toBe(ids.alice);
    await expect(service.changeOwner(org.id, 'gone', 'ADMIN')).rejects.toThrow();
    expect((await service.getOrganization('chuyen-owner', { id: ids.adm!, role: 'ADMIN' })).owner?.id).toBe(ids.alice);
  });

  it('ARCHIVE/RESTORE và quyền xem', async () => {
    const org = await service.createOrganization({ name: 'Lưu trữ', slug: 'luu-tru', ownerIdentifier: 'alice' });
    const admin = { id: ids.adm!, role: 'ADMIN' as const };
    await service.archive(org.id, ids.adm!);
    await expect(service.archive(org.id, ids.adm!)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.getOrganization('luu-tru', null)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getOrganization('luu-tru', { id: ids.alice!, role: 'STUDENT' })).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.getOrganization('luu-tru', admin)).status).toBe('ARCHIVED');
    const detail = await service.getAdminOrganization(org.id);
    expect(detail).toMatchObject({ status: 'ARCHIVED', sourceRequestId: null, owner: { username: 'alice' } });
    expect((await service.listAdminMembers(org.id, { page: 1, pageSize: 10 })).items[0]).toMatchObject({ username: 'alice', role: 'OWNER' });
    await expect(service.getAdminOrganization('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateOrganizationById(org.id, { name: 'Sửa' })).rejects.toBeInstanceOf(ConflictException);
    expect((await service.listOrganizations({ page: 1, pageSize: 50, sort: 'name' })).items.some((o) => o.slug === 'luu-tru')).toBe(false);
    const restored = await service.restore(org.id);
    expect(restored.status).toBe('ACTIVE');
    expect(restored.archivedAt).toBeNull();
    await expect(service.restore(org.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('OWNER/ADMIN tổ chức sửa thông tin + visibility, MEMBER và người ngoài thì không', async () => {
    const org = await service.createOrganization({ name: 'Phân quyền', slug: 'phan-quyen', ownerIdentifier: 'alice' });
    await pool.query(`INSERT INTO public.organization_members (organization_id,user_id,role) VALUES ($1,$2,'ADMIN'),($1,$3,'MEMBER')`, [org.id, ids.bob, ids.carol]);
    const alice = { id: ids.alice!, role: 'STUDENT' as const };
    const bob = { id: ids.bob!, role: 'STUDENT' as const };
    const carol = { id: ids.carol!, role: 'STUDENT' as const };
    const updated = await service.updateInfo('phan-quyen', alice, { slug: 'phan-quyen-moi', description: 'mô tả' });
    expect(updated.slug).toBe('phan-quyen-moi');
    const vis = await service.updateVisibility('phan-quyen-moi', bob, { problemsVisibility: 'PUBLIC' });
    expect(vis.problemsVisibility).toBe('PUBLIC');
    expect(vis.contestsVisibility).toBe('PRIVATE');
    await expect(service.updateInfo('phan-quyen-moi', carol, { name: 'hack' })).rejects.toMatchObject({ status: 403 });
    await expect(service.getManage('phan-quyen-moi', carol)).rejects.toMatchObject({ status: 403 });
    await expect(service.updateInfo('phan-quyen-moi', { id: ids.adm!, role: 'ADMIN' }, { slug: 'khoa-cntt' })).rejects.toBeInstanceOf(ConflictException);
    const members = await service.listMembers('phan-quyen-moi', null, { page: 1, pageSize: 10 });
    expect(members.items.map((m) => m.role)).toEqual(['OWNER', 'ADMIN', 'MEMBER']);
    expect(JSON.stringify(members)).not.toMatch(/@t\.test|password/);
    expect(JSON.stringify(await service.getOrganization('phan-quyen-moi', null))).not.toMatch(/@t\.test|password|archivedBy/);
  });

  it('join/leave, trùng, đồng thời, nhiều tổ chức, OWNER không tự rời, memberCount', async () => {
    const dave = await pool.query<{ id: string }>(
      `INSERT INTO public.users (username, email, password_hash, role, is_active, full_name)
       VALUES ('dave','dave@t.test','x','STUDENT',TRUE,'dave') RETURNING id`,
    );
    const user = { id: dave.rows[0]!.id, role: 'STUDENT' as const };
    const o1 = await service.createOrganization({ name: 'Join Một', slug: 'join-mot', ownerIdentifier: 'alice' });
    const o2 = await service.createOrganization({ name: 'Join Hai', slug: 'join-hai' });
    await expect(service.join('join-mot', null)).rejects.toMatchObject({ status: 401 });
    expect((await service.join('join-mot', user)).viewerRole).toBe('MEMBER');
    await expect(service.join('join-mot', user)).rejects.toBeInstanceOf(ConflictException);
    const afterJoin = await service.join('join-hai', user);
    expect(afterJoin).toMatchObject({ viewerRole: 'MEMBER', memberCount: 1 });
    expect((await repo.findById(o1.id))?.memberCount).toBe(2);

    // Hai yêu cầu đồng thời: đúng một thành công
    const erin = await pool.query<{ id: string }>(
      `INSERT INTO public.users (username, email, password_hash, role, is_active, full_name)
       VALUES ('erin','erin@t.test','x','STUDENT',TRUE,'erin') RETURNING id`,
    );
    const erinViewer = { id: erin.rows[0]!.id, role: 'STUDENT' as const };
    const settled = await Promise.allSettled([service.join('join-hai', erinViewer), service.join('join-hai', erinViewer)]);
    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await repo.findById(o2.id))?.memberCount).toBe(2);

    await expect(service.leave('join-mot', { id: ids.alice!, role: 'STUDENT' })).rejects.toBeInstanceOf(ConflictException);
    expect((await service.leave('join-mot', user)).viewerRole).toBeNull();
    await expect(service.leave('join-mot', user)).rejects.toBeInstanceOf(NotFoundException);
    expect((await repo.findById(o1.id))?.memberCount).toBe(1);
    // Không có FK từ submissions tới organization_members nên rời tổ chức không xóa bài nộp.
    const fks = await pool.query(
      `SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid='public.organization_members'::regclass
        AND conrelid='public.submissions'::regclass`,
    );
    expect(fks.rowCount).toBe(0);
  });

  it('quản lý thành viên theo vai trò và chặn ARCHIVED', async () => {
    const alice = { id: ids.alice!, role: 'STUDENT' as const }; // OWNER
    const bob = { id: ids.bob!, role: 'STUDENT' as const };
    const carol = { id: ids.carol!, role: 'STUDENT' as const };
    const adm = { id: ids.adm!, role: 'ADMIN' as const };
    const org = await service.createOrganization({ name: 'Thành viên', slug: 'thanh-vien', ownerIdentifier: 'alice' });

    await expect(service.addMember('thanh-vien', bob, 'carol', 'MEMBER')).rejects.toMatchObject({ status: 403 });
    expect(await service.addMember('thanh-vien', alice, 'BOB@t.test', 'ADMIN')).toMatchObject({ username: 'bob', role: 'ADMIN' });
    await expect(service.addMember('thanh-vien', alice, 'bob', 'MEMBER')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.addMember('thanh-vien', alice, 'gone', 'MEMBER')).rejects.toMatchObject({ status: 400 });
    await expect(service.addMember('thanh-vien', alice, 'khong-ton-tai', 'MEMBER')).rejects.toMatchObject({ status: 400 });

    // ADMIN tổ chức: chỉ thêm MEMBER, không cấp ADMIN, không sửa/xóa OWNER hay ADMIN
    await expect(service.addMember('thanh-vien', bob, 'carol', 'ADMIN')).rejects.toMatchObject({ status: 403 });
    expect(await service.addMember('thanh-vien', bob, 'carol', 'MEMBER')).toMatchObject({ role: 'MEMBER' });
    await expect(service.changeMemberRole('thanh-vien', bob, ids.carol!, 'ADMIN')).rejects.toMatchObject({ status: 403 });
    await expect(service.removeMember('thanh-vien', bob, ids.alice!)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeMember('thanh-vien', bob, ids.bob!)).rejects.toMatchObject({ status: 400 });

    // OWNER đổi vai trò, nhưng không đụng tới chính mình/OWNER; Admin hệ thống cũng không
    expect(await service.changeMemberRole('thanh-vien', alice, ids.carol!, 'ADMIN')).toMatchObject({ role: 'ADMIN' });
    await expect(service.removeMember('thanh-vien', carol, ids.bob!)).rejects.toMatchObject({ status: 403 });
    await expect(service.changeMemberRole('thanh-vien', alice, ids.alice!, 'MEMBER')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.changeMemberRole('thanh-vien', adm, ids.alice!, 'MEMBER')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeMember('thanh-vien', adm, ids.alice!)).rejects.toBeInstanceOf(ConflictException);
    expect((await ownerRows(org.id)).rows.filter((r) => r.role === 'OWNER')).toHaveLength(1);

    expect(await service.removeMember('thanh-vien', adm, ids.carol!)).toEqual({ removed: true });
    await expect(service.removeMember('thanh-vien', alice, ids.carol!)).rejects.toBeInstanceOf(NotFoundException);
    expect((await repo.findById(org.id))?.memberCount).toBe(2);
    expect((await pool.query(`SELECT 1 FROM public.users WHERE id=$1`, [ids.carol])).rowCount).toBe(1);

    await service.archive(org.id, ids.adm!);
    await expect(service.addMember('thanh-vien', adm, 'carol', 'MEMBER')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.join('thanh-vien', adm)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeMember('thanh-vien', alice, ids.bob!)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.leave('thanh-vien', bob)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('memberCount thật và tìm kiếm', async () => {
    const page = await service.listOrganizations({ page: 1, pageSize: 50, sort: 'members', q: 'phân quyền' });
    expect(page.items).toHaveLength(1);
    const all = await service.listOrganizations({ page: 1, pageSize: 50, sort: 'members' });
    expect(all.items.find((o) => o.slug === 'phan-quyen-moi')?.memberCount).toBe(3);
  });
});
