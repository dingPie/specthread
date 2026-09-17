import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, splitHeadingNum } from '../utils/anchor.ts';

test('slugify - 번호 뒤 마침표를 지우고 공백을 하이픈으로', () => {
  assert.equal(slugify('1. 개요'), '1-개요');
  assert.equal(slugify('2. 수평 규칙'), '2-수평-규칙');
  assert.equal(slugify('참조'), '참조');
});

test('slugify - 공백을 하나씩 바꾼다', () => {
  // 지워지는 구두점 자리에 공백 둘이 남으면 하이픈도 둘이다 (GitHub 방식)
  assert.equal(slugify('6. P2 작업 항목 · 형식이 아니라 내용'), '6-p2-작업-항목--형식이-아니라-내용');
  assert.equal(slugify('2. 참조 · 단순 참조와 보완 참조'), '2-참조--단순-참조와-보완-참조');
  // 하이픈은 허용 문자라 지워지지 않는다. 양옆 공백까지 셋이 된다
  assert.equal(slugify('6. P2 작업 항목 - 형식이 아니라 내용'), '6-p2-작업-항목---형식이-아니라-내용');
});

test('slugify - 대괄호·쉼표를 지운다', () => {
  assert.equal(slugify('6-3. minDamage 1 적용 범위 [D2, D22]'), '6-3-mindamage-1-적용-범위-d2-d22');
});

test('splitHeadingNum - 숫자 번호', () => {
  assert.deepEqual(splitHeadingNum('6-1. 기본 데미지'), { num: '6-1', title: '기본 데미지' });
  assert.deepEqual(splitHeadingNum('1. 개요'), { num: '1', title: '개요' });
});

test('splitHeadingNum - 중간에 문자가 오는 번호도 받는다', () => {
  assert.deepEqual(splitHeadingNum('1-B-1. 스킬트리 디자인'), {
    num: '1-B-1',
    title: '스킬트리 디자인',
  });
  assert.deepEqual(splitHeadingNum('1-A. 사전 락'), { num: '1-A', title: '사전 락' });
});

test('splitHeadingNum - 번호가 아닌 것을 번호로 보지 않는다', () => {
  assert.deepEqual(splitHeadingNum('변경 이력'), { num: null, title: '변경 이력' });
  // 날짜는 뒤에 마침표가 없으므로 번호가 아니다
  assert.deepEqual(splitHeadingNum('2026-05-24 1차 락'), {
    num: null,
    title: '2026-05-24 1차 락',
  });
});
