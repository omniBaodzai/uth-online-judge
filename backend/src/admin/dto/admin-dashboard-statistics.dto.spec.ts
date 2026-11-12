import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminDashboardStatisticsQueryDto } from './admin-dashboard-statistics.dto.js';

describe('AdminDashboardStatisticsQueryDto', () => {
  it.each([
    ['7', 'GLOBAL'],
    ['30', 'ORGANIZATION'],
    ['90', 'GLOBAL'],
  ])('accepts supported range %s and scope %s', async (days, submissionScope) => {
    const query = plainToInstance(AdminDashboardStatisticsQueryDto, { days, submissionScope });
    await expect(validate(query, { whitelist: true, forbidNonWhitelisted: true })).resolves.toHaveLength(0);
    expect(query.days).toBe(Number(days));
  });

  it.each([
    { days: '6', submissionScope: 'GLOBAL' },
    { days: '365', submissionScope: 'GLOBAL' },
    { days: '30.5', submissionScope: 'GLOBAL' },
    { days: '30', submissionScope: 'ALL' },
  ])('rejects unsupported query values %#', async (input) => {
    const query = plainToInstance(AdminDashboardStatisticsQueryDto, input);
    await expect(validate(query, { whitelist: true, forbidNonWhitelisted: true })).resolves.not.toHaveLength(0);
  });

  it('uses the bounded defaults when omitted', async () => {
    const query = plainToInstance(AdminDashboardStatisticsQueryDto, {});
    await expect(validate(query, { whitelist: true, forbidNonWhitelisted: true })).resolves.toHaveLength(0);
    expect(query).toMatchObject({ days: 30, submissionScope: 'GLOBAL' });
  });
});
