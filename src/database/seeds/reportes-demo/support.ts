import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { CategoriaReporte } from '../../../common/domain/enums/categoria-reporte.enum';
import { StatusReporte } from '../../../common/domain/enums/status-reporte.enum';

export interface DemoCitizen {
  id: string;
  nome: string;
  email: string;
  bairro: string;
}

export interface DemoReport {
  id: string;
  autorId: string;
  categoria: CategoriaReporte;
  descricao: string;
  bairro: string;
  localizacao: string;
  status: StatusReporte;
  daysAgo: number;
  photo: {
    title: string;
    source: string;
    download: string;
    original: string;
    author: string;
    license: string;
    licenseUrl: string;
    attribution: string;
    changes: string;
    verifiedAt: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
  };
}

export interface DemoManifest {
  version: number;
  notice: string;
  citizens: DemoCitizen[];
  reports: DemoReport[];
}

export function imageCredits(manifest: DemoManifest): string {
  const escape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c]!,
    );
  return (
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Créditos das fotos demonstrativas</title><h1>Créditos das fotos demonstrativas</h1><p>' +
    escape(manifest.notice) +
    '</p><p>As fotos conservam as licenças individuais abaixo. As licenças das fotos não alteram a licença do código da aplicação.</p><ol>' +
    manifest.reports
      .map(
        (r) =>
          '<li><a href="' +
          escape(r.photo.source) +
          '">' +
          escape(r.photo.title) +
          '</a> — ' +
          escape(r.photo.author) +
          ' — <a rel="license" href="' +
          escape(r.photo.licenseUrl) +
          '">' +
          escape(r.photo.license) +
          '</a>. ' +
          escape(r.photo.changes) +
          '</li>',
      )
      .join('\n') +
    '</ol></html>\n'
  );
}

export const digest = (value: Buffer | string): string =>
  createHash('sha256').update(value).digest('hex');

export function requireLocalTarget(
  env: NodeJS.ProcessEnv,
  args: string[],
): string {
  if (
    env.NODE_ENV &&
    !['development', 'local', 'test'].includes(env.NODE_ENV)
  ) {
    throw new Error(
      'Seed recusado: NODE_ENV deve ser development, local ou test.',
    );
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST ?? 'localhost')) {
    throw new Error('Seed recusado: somente MySQL em loopback é permitido.');
  }
  const target = `${env.DB_HOST ?? 'localhost'}:${env.DB_PORT ?? '3306'}/${env.DB_NAME ?? 'cidades_inteligentes'}`;
  if (args.includes('--apply')) {
    if (!args.includes('--local-development')) {
      throw new Error(
        'Informe --local-development para declarar ambiente local exclusivo de demonstração.',
      );
    }
    if (!args.includes(`--target=${target}`)) {
      throw new Error(`Confirme o destino exato com --target=${target}`);
    }
  }
  return target;
}

export function inside(root: string, path: string): string {
  const result = resolve(path);
  const rel = relative(resolve(root), result);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Caminho fora da pasta autorizada: ' + path);
  }
  return result;
}

export function uploadFile(root: string, url: string): string {
  if (!/^\/uploads\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(url)) {
    throw new Error('Caminho de imagem inválido: ' + url);
  }
  return inside(root, resolve(root, url.slice('/uploads/'.length)));
}

export function validateManifest(manifest: DemoManifest): void {
  const { citizens, reports } = manifest;
  if (citizens.length !== 10 || reports.length !== 20) {
    throw new Error('O manifesto deve conter 10 cidadãos e 20 reportes.');
  }
  for (const values of [
    citizens.map((c) => c.id),
    citizens.map((c) => c.email),
    reports.map((r) => r.id),
    reports.map((r) => r.bairro),
    reports.map((r) => r.descricao),
    reports.map((r) => r.photo.sha256),
  ]) {
    if (new Set(values).size !== values.length)
      throw new Error('Valores duplicados no manifesto.');
  }
  for (const c of citizens) {
    if (!c.email.endsWith('@example.com') || !c.nome || !c.bairro)
      throw new Error('Cidadão fictício inválido.');
    if (reports.filter((r) => r.autorId === c.id).length !== 2)
      throw new Error('Cada cidadão deve possuir 2 reportes.');
  }
  for (const category of Object.values(CategoriaReporte)) {
    if (reports.filter((r) => r.categoria === category).length !== 4)
      throw new Error('Cada categoria deve conter 4 reportes.');
  }
  const expectedStatuses: Record<StatusReporte, number> = {
    ABERTO: 12,
    EM_ANDAMENTO: 5,
    RESOLVIDO: 3,
  };
  for (const status of Object.values(StatusReporte)) {
    if (
      reports.filter((r) => r.status === status).length !==
      expectedStatuses[status]
    )
      throw new Error('Distribuição de status inválida.');
  }
  for (const r of reports) {
    if (
      !r.descricao ||
      r.descricao.length > 300 ||
      !r.localizacao.includes(r.bairro) ||
      !r.localizacao.includes('Sorocaba - SP') ||
      !r.localizacao.includes('fictícia')
    )
      throw new Error('Texto inválido: ' + r.id);
    if (!Number.isInteger(r.daysAgo) || r.daysAgo < 1 || r.daysAgo > 29)
      throw new Error('Data fora dos últimos 30 dias.');
    if (!citizens.some((c) => c.id === r.autorId))
      throw new Error('Autor inválido.');
    if (
      ![
        'CC0',
        'Public domain',
        'CC BY 2.0',
        'CC BY-SA 2.0',
        'CC BY-SA 3.0',
        'CC BY-SA 4.0',
      ].includes(r.photo.license) ||
      !r.photo.author ||
      !r.photo.attribution ||
      !r.photo.licenseUrl.startsWith('https://creativecommons.org/')
    )
      throw new Error('Licença não aprovada.');
    if (
      new URL(r.photo.source).hostname !== 'commons.wikimedia.org' ||
      !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(
        new URL(r.photo.download).hostname,
      ) ||
      new URL(r.photo.download).protocol !== 'https:'
    )
      throw new Error('Fonte não aprovada.');
  }
}

// Hashes pin the exact thumbnails decoded and visually reviewed for this manifest.
export function validatePhoto(bytes: Buffer, photo: DemoReport['photo']): void {
  if (
    bytes.length > 5 * 1024 * 1024 ||
    bytes.length !== photo.bytes ||
    digest(bytes) !== photo.sha256 ||
    bytes.readUInt16BE(0) !== 0xffd8 ||
    bytes.readUInt16BE(bytes.length - 2) !== 0xffd9
  ) {
    throw new Error(
      'Imagem inválida, corrompida ou diferente da foto licenciada: ' +
        photo.title,
    );
  }
}
