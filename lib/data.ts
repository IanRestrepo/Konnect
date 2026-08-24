import { read } from "@/lib/store";
import type { Campaign, CampaignMetrics, Company, Creator } from "@/lib/types";

/** Lectura de datos. Hoy sobre el archivo local; mañana sobre Prisma/Neon. */

export async function getCreators(): Promise<Creator[]> {
  return (await read()).creators;
}

export async function getCreator(id: string): Promise<Creator | null> {
  return (await read()).creators.find((c) => c.id === id) ?? null;
}

export async function getCompanies(): Promise<Company[]> {
  return (await read()).companies;
}

export async function getCompany(id: string): Promise<Company | null> {
  return (await read()).companies.find((c) => c.id === id) ?? null;
}

export async function getCampaigns(): Promise<Campaign[]> {
  return (await read()).campaigns;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  return (await read()).campaigns.find((c) => c.id === id) ?? null;
}

/* ---------- Cálculos derivados ---------- */

export function campaignMetrics(campaign: Campaign): CampaignMetrics {
  const published = campaign.deliverables.filter((d) => d.status === "publicado");
  const views = published.reduce((s, d) => s + (d.views ?? 0), 0);
  const likes = published.reduce((s, d) => s + (d.likes ?? 0), 0);
  const comments = published.reduce((s, d) => s + (d.comments ?? 0), 0);
  const spent = campaign.deliverables
    .filter((d) => d.status !== "cancelado")
    .reduce((s, d) => s + d.agreedFee, 0);

  return {
    views,
    likes,
    comments,
    spent,
    cpm: views > 0 ? (spent / views) * 1000 : null,
    engagementRate: views > 0 ? ((likes + comments) / views) * 100 : null,
    published: published.length,
    total: campaign.deliverables.length,
  };
}

export function creatorCampaigns(campaigns: Campaign[], creatorId: string) {
  return campaigns.filter((c) => c.deliverables.some((d) => d.creatorId === creatorId));
}

export function companyCampaigns(campaigns: Campaign[], companyId: string) {
  return campaigns.filter((c) => c.companyId === companyId);
}
