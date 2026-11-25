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