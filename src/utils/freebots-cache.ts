import localforage from 'localforage';
import LZString from 'lz-string';

export type TBotsManifestItem = {
    name: string;
    file: string; // xml filename in /public/xml
    description?: string;
    difficulty?: string;
    strategy?: string;
    features?: string[];
};

const XML_CACHE_PREFIX = 'freebots:xml:';

const decompress = (data: string | null) => (data ? LZString.decompressFromUTF16(data) : null);
const compress = (data: string) => LZString.compressToUTF16(data);

export const getCachedXml = async (file: string): Promise<string | null> => {
    try {
        const key = `${XML_CACHE_PREFIX}${file}`;
        const cached = (await localforage.getItem<string>(key)) || null;
        return decompress(cached);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('freebots-cache:getCachedXml error', e);
        return null;
    }
};

export const setCachedXml = async (file: string, xml: string) => {
    try {
        const key = `${XML_CACHE_PREFIX}${file}`;
        await localforage.setItem(key, compress(xml));
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('freebots-cache:setCachedXml error', e);
    }
};

export const fetchXmlWithCache = async (file: string): Promise<string | null> => {
    const cached = await getCachedXml(file);
    if (cached) return cached;

    try {
        const url = `/xml/${encodeURIComponent(file)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
        const xml = await res.text();
        await setCachedXml(file, xml);
        return xml;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('freebots-cache:fetchXmlWithCache error', e);
        return null;
    }
};

export const prefetchAllXmlInBackground = async (files: string[]) => {
    // Fire-and-forget prefetch
    files.forEach(file => {
        fetchXmlWithCache(file).catch(() => undefined);
    });
};

export const getBotsManifest = async (): Promise<TBotsManifestItem[] | null> => {
    try {
        const res = await fetch('/xml/bots.json', { cache: 'force-cache' });
        if (!res.ok) return null;
        const data = (await res.json()) as TBotsManifestItem[];
        return data;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('freebots-cache:getBotsManifest error', e);
        return null;
    }
};

