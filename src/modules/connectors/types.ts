/**
 * Defines the Appendix A connector contracts shared by connector implementations.
 * These types are erased at runtime, preserving the existing CommonJS behaviour.
 */
import codes = require('../../shared/errors/codes');

export type ErrorCode = keyof typeof codes;
export type Tier = 'native' | 'protocol' | 'bridge' | 'feed' | 'assisted';

export interface Manifest {
  key: string;
  version: string;
  tier: Tier;
  auth: string;
  surfaces: Array<{ key: string; spec: Record<string, any>; [key: string]: any }>;
  rate_limits: Record<string, any>;
  capabilities: string[];
  error_map: Record<string, ErrorCode>;
  instance_param: string;
}

export interface Rendition {
  title: string;
  body: string;
  canonical_url?: string;
  language?: string;
  is_promotional?: boolean;
  ai_generated?: boolean;
  links?: string[];
  media?: Array<{ name?: string; url: string; type: string }>;
  tags?: string[];
}

export interface Destination {
  name: string;
  url: string;
  platform_key: string;
  surface: string;
  category: string | null;
  audience_tags: string[];
  language: string | null;
  geo: string | null;
  est_audience: number | null;
  rules_url: string | null;
  frequency_cap: { posts: number; per_days: number } | null;
  self_promo_allowed: boolean | null;
  link_policy: string | null;
  disclosure_required: boolean;
  automation_allowed: boolean;
  connector_key: string;
  config: Record<string, any>;
  connection_ref: string | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  level: string | null;
  last_certified_at: string | null;
  enabled: boolean;
  demoted: boolean;
  id: string;
  [key: string]: any;
}

export interface Connection {
  api_key?: string;
  api_username?: string;
  signing_secret?: string;
  [key: string]: any;
}

export interface Violation {
  field: string;
  code: string;
  message: string;
}

export interface PublishResult {
  platform_post_id: string;
  live_url: string;
  status: string;
}

export interface StatusResult {
  status: string;
  live_url: string | null;
}

export interface DeleteResult {
  deleted: boolean;
}

export interface AssistPack {
  files: Array<{ name: string; url: string; type: string }>;
  caption: string;
  deep_link: string;
  checklist: Array<{ item: string; required: boolean; done: boolean }>;
}

export interface Connector {
  key: string;
  manifest: Manifest;
  validate(rendition: Rendition, surfaceKey?: string): Violation[];
  publish(rendition: Rendition, destination: Destination, connection: Connection, key: string): Promise<PublishResult>;
  get_status(destination: Destination, connection: Connection, id: string): Promise<StatusResult>;
  delete(destination: Destination, connection: Connection, id: string): Promise<DeleteResult>;
  findByMarker(destination: Destination, connection: Connection, marker: string): Promise<PublishResult | null>;
  fetch_metrics?: (...args: any[]) => Promise<any>;
  refresh_auth?: (...args: any[]) => Promise<any>;
  build_assist_pack?: (rendition: Rendition, destination: Destination) => AssistPack;
}
