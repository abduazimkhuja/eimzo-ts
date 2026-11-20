import { describe, expect, it } from 'vitest';
import { parseCertificateInfo, parseX500 } from '../src';
import { PFX_ALIAS } from './helpers';

describe('parseX500', () => {
  it('разбирает атрибуты, OID ПИНФЛ/ИНН и значения с запятыми', () => {
    const a = parseX500(PFX_ALIAS);
    expect(a.CN).toBe('ivanov ivan');
    expect(a.O).toBe('ooo "romashka, llc"');
    expect(a.PINFL).toBe('31234567890123');
    expect(a.UID).toBe('123456789');
    expect(a.VALIDTO).toBe('2099.01.10 23:59:59');
    expect(parseX500('CN=x,1.2.860.3.16.1.1=301234567').INN).toBe('301234567');
  });
});

describe('parseCertificateInfo', () => {
  it('собирает данные ключа, TIN берётся из UID при отсутствии ИНН', () => {
    const info = parseCertificateInfo(PFX_ALIAS)!;
    expect(info).toMatchObject({
      CN: 'IVANOV IVAN',
      O: 'OOO "ROMASHKA, LLC"',
      T: 'DIRECTOR',
      TIN: '123456789',
      PINFL: '31234567890123',
      serialNumber: '7826a1b',
    });
    expect(info.validTo?.getFullYear()).toBe(2099);
    expect(info.expired).toBe(false);
  });

  it('отмечает истёкший сертификат', () => {
    const info = parseCertificateInfo('cn=a,uid=1,validto=2020.01.01 00:00:00')!;
    expect(info.expired).toBe(true);
  });

  it('пропускает сертификат без ИНН и ПИНФЛ', () => {
    expect(parseCertificateInfo('cn=a,serialnumber=1')).toBeNull();
  });
});

describe('parseX500: случайные строки', () => {
  // Детерминированный генератор: упавший случай воспроизводится по seed.
  const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const alphabet = 'abcXYZ019 ,=.\n"-а';

  it('не падает на произвольном тексте', () => {
    const next = rng(1);
    for (let i = 0; i < 2000; i++) {
      const s = Array.from(
        { length: Math.floor(next() * 60) },
        () => alphabet[Math.floor(next() * alphabet.length)],
      ).join('');
      expect(() => parseCertificateInfo(s)).not.toThrow();
    }
  });

  it('возвращает значения сгенерированных атрибутов, даже с запятыми внутри', () => {
    const next = rng(2);
    const word = () =>
      Array.from({ length: 1 + Math.floor(next() * 8) }, () => 'ab, cd'[Math.floor(next() * 6)])
        .join('')
        .trim() || 'x';
    for (let i = 0; i < 500; i++) {
      const cn = word();
      const o = word();
      const parsed = parseX500(`cn=${cn},o=${o},uid=1`);
      expect(parsed).toMatchObject({ CN: cn, O: o, UID: '1' });
    }
  });
});

describe('parseCertificateInfo: даты', () => {
  it('дата PFX без часового пояса понимается как локальное время компьютера', () => {
    const info = parseCertificateInfo(PFX_ALIAS)!;
    const to = info.validTo!;
    expect([to.getFullYear(), to.getMonth(), to.getDate(), to.getHours()]).toEqual([2099, 0, 10, 23]);
  });
});
