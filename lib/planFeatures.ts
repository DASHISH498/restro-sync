export type OutletSetupMode = 'single' | 'multiple';
export type MultiOutletTierRank = 1 | 2 | 3 | 4 | 5;

export interface MultiOutletCapabilities {
  tierRank: MultiOutletTierRank;
  tierName: '1 Month' | '3 Months' | '6 Months' | 'Yearly' | 'Lifetime';
  maxOutlets: number | null; // null = unlimited outlets
  canInspectOutletCustomers: boolean; // Unlocked from 3 Months+
  canUseCustomDateRange: boolean; // Unlocked from 6 Months+
  canViewDeletedArchive: boolean; // Unlocked from 6 Months+
  canRestoreDeletedOutlet: boolean; // Unlocked from Yearly+
}

export const TRIAL_DURATION_DAYS = 7;

export function getCalendarExpiryDate(
  planId?: string | null,
  selectedPlanLabel?: string | null,
  fromDate: Date = new Date()
): Date {
  const combined = `${planId || ''} ${selectedPlanLabel || ''}`.toLowerCase();
  const expiry = new Date(fromDate.getTime());

  if (combined.includes('lifetime') || combined.includes('37,199') || combined.includes('19,999')) {
    expiry.setFullYear(expiry.getFullYear() + 100);
    return expiry;
  }

  if (combined.includes('yearly') || combined.includes('27,899') || combined.includes('5,499')) {
    expiry.setFullYear(expiry.getFullYear() + 1);
    return expiry;
  }

  if (
    combined.includes('6_month') ||
    combined.includes('6 month') ||
    combined.includes('18,599') ||
    combined.includes('3,299')
  ) {
    expiry.setMonth(expiry.getMonth() + 6);
    return expiry;
  }

  if (
    combined.includes('3_month') ||
    combined.includes('3 month') ||
    combined.includes('11,159') ||
    combined.includes('1,699')
  ) {
    expiry.setMonth(expiry.getMonth() + 3);
    return expiry;
  }

  if (
    combined.includes('1_month') ||
    combined.includes('1 month') ||
    combined.includes('1,115') ||
    combined.includes('599')
  ) {
    expiry.setMonth(expiry.getMonth() + 1);
    return expiry;
  }

  expiry.setMonth(expiry.getMonth() + 1);
  return expiry;
}

export function isTrialExpiredRecord(record?: {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
} | null): boolean {
  if (!record) return false;
  const status = (record.subscription_status || '').toLowerCase();
  if (status === 'active') return false;
  if (!record.trial_ends_at) return false;
  return new Date(record.trial_ends_at).getTime() <= Date.now();
}

export function getMultiOutletTierRank(
  planType?: string | null,
  selectedPlanLabel?: string | null,
): MultiOutletTierRank {
  const combined = `${planType || ''} ${selectedPlanLabel || ''}`.toLowerCase();

  if (combined.includes('lifetime') || combined.includes('37,199')) {
    return 5;
  }
  if (combined.includes('yearly') || combined.includes('27,899')) {
    return 4;
  }
  if (
    combined.includes('6_month') ||
    combined.includes('6 month') ||
    combined.includes('18,599')
  ) {
    return 3;
  }
  if (
    combined.includes('3_month') ||
    combined.includes('3 month') ||
    combined.includes('11,159')
  ) {
    return 2;
  }
  return 1; // 1 Month starter tier
}

export function getMaxOutletsForPlan(
  planType?: string | null,
  selectedPlanLabel?: string | null,
  outletMode?: string | null,
): number | null {
  const combined = `${planType || ''} ${selectedPlanLabel || ''}`.toLowerCase();

  if (combined.includes('multi_lifetime') || combined.includes('37,199')) {
    return null;
  }
  if (combined.includes('multi_yearly') || combined.includes('27,899')) {
    return 15;
  }
  if (
    combined.includes('multi_6_months') ||
    combined.includes('6 month') ||
    combined.includes('18,599')
  ) {
    return 8;
  }
  if (
    combined.includes('multi_3_months') ||
    combined.includes('3 month') ||
    combined.includes('11,159')
  ) {
    return 5;
  }
  if (
    combined.includes('multi_1_month') ||
    combined.includes('1 month') ||
    combined.includes('1,115')
  ) {
    return 2;
  }
  if (outletMode === 'multiple') {
    return 2;
  }
  return 1;
}

export function getMultiOutletCapabilities(
  planType?: string | null,
  selectedPlanLabel?: string | null,
  outletMode?: string | null,
): MultiOutletCapabilities {
  const tierRank = getMultiOutletTierRank(planType, selectedPlanLabel);
  const maxOutlets = getMaxOutletsForPlan(
    planType,
    selectedPlanLabel,
    outletMode || 'multiple',
  );

  const tierName: MultiOutletCapabilities['tierName'] =
    tierRank === 5
      ? 'Lifetime'
      : tierRank === 4
        ? 'Yearly'
        : tierRank === 3
          ? '6 Months'
          : tierRank === 2
            ? '3 Months'
            : '1 Month';

  return {
    tierRank,
    tierName,
    maxOutlets,
    canInspectOutletCustomers: tierRank >= 2,
    canUseCustomDateRange: tierRank >= 3,
    canViewDeletedArchive: tierRank >= 3,
    canRestoreDeletedOutlet: tierRank >= 4,
  };
}