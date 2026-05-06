'use strict';

const crypto = require('crypto');
const db = uniCloud.database();
const settingsCollection = db.collection('money-settings');
const recordsCollection = db.collection('money-records');

const SETTINGS_KEY = 'default';
const TOKEN_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

function ok(data = {}, msg = 'ok') {
	return { code: 0, msg, data };
}

function fail(msg, code = -1) {
	return { code, msg };
}

function now() {
	return Date.now();
}

function normalizeAmountToCents(amount) {
	const value = Number(amount);
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error('金额必须大于 0');
	}
	const cents = Math.round(value * 100);
	if (cents <= 0) {
		throw new Error('金额至少 0.01');
	}
	return cents;
}

function hashPassword(password, salt) {
	return crypto
		.createHash('sha256')
		.update(`${salt}:${password}`)
		.digest('hex');
}

function signPayload(payload, setting) {
	const secret = `${setting.password_hash}:${setting.password_salt}:${setting.token_version || 1}`;
	return crypto
		.createHmac('sha256', secret)
		.update(payload)
		.digest('hex');
}

function encodeToken(payload, setting) {
	const body = Buffer.from(JSON.stringify(payload)).toString('base64');
	const signature = signPayload(body, setting);
	return `${body}.${signature}`;
}

function decodeToken(token, setting) {
	if (!token || typeof token !== 'string') return null;
	const parts = token.split('.');
	if (parts.length !== 2) return null;

	const [body, signature] = parts;
	const expected = signPayload(body, setting);
	if (signature !== expected) return null;

	try {
		const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
		if (!payload.exp || payload.exp < now()) return null;
		return payload;
	} catch (e) {
		return null;
	}
}

async function getSetting() {
	const res = await settingsCollection.where({ key: SETTINGS_KEY }).limit(1).get();
	return res.data && res.data[0];
}

async function requireAuth(token) {
	const setting = await getSetting();
	if (!setting) {
		throw new Error('请先设置管理密码');
	}
	const payload = decodeToken(token, setting);
	if (!payload) {
		throw new Error('登录已失效，请重新输入密码');
	}
	return setting;
}

async function getAuthState() {
	const setting = await getSetting();
	return ok({ hasPassword: !!setting });
}

async function setupPassword(payload = {}) {
	const password = String(payload.password || '').trim();
	if (password.length < 4) {
		return fail('密码至少 4 位');
	}

	const existing = await getSetting();
	if (existing) {
		return fail('管理密码已设置，请直接登录');
	}

	const salt = crypto.randomBytes(16).toString('hex');
	const createdAt = now();
	const setting = {
		key: SETTINGS_KEY,
		password_hash: hashPassword(password, salt),
		password_salt: salt,
		token_version: 1,
		created_at: createdAt,
		updated_at: createdAt
	};
	await settingsCollection.add(setting);

	const token = encodeToken({ key: SETTINGS_KEY, exp: createdAt + TOKEN_MAX_AGE }, setting);
	return ok({ token, expiresAt: createdAt + TOKEN_MAX_AGE });
}

async function login(payload = {}) {
	const password = String(payload.password || '').trim();
	const setting = await getSetting();
	if (!setting) {
		return fail('请先设置管理密码', 1001);
	}
	if (!password || hashPassword(password, setting.password_salt) !== setting.password_hash) {
		return fail('密码不正确', 1002);
	}

	const createdAt = now();
	const token = encodeToken({ key: SETTINGS_KEY, exp: createdAt + TOKEN_MAX_AGE }, setting);
	return ok({ token, expiresAt: createdAt + TOKEN_MAX_AGE });
}

async function verifyToken(payload = {}) {
	const setting = await requireAuth(payload.token);
	const tokenPayload = decodeToken(payload.token, setting);
	return ok({ valid: true, expiresAt: tokenPayload.exp });
}

async function getConsumableBalance() {
	const res = await recordsCollection.limit(1000).get();
	return (res.data || []).reduce((sum, record) => {
		if (record.type === 'income') return sum + Number(record.amount || 0);
		if (record.type === 'expense') return sum - Number(record.amount || 0);
		return sum;
	}, 0);
}

async function createRecord(payload = {}) {
	const type = payload.type;
	if (!['income', 'expense', 'deposit'].includes(type)) {
		return fail('记录类型不正确');
	}

	let amount = 0;
	try {
		amount = normalizeAmountToCents(payload.amount);
	} catch (e) {
		return fail(e.message);
	}

	if (type === 'expense') {
		const balance = await getConsumableBalance();
		if (balance < amount) {
			return fail('可消费余额不足');
		}
	}

	const createdAt = now();
	const record = {
		type,
		amount,
		category_id: '',
		category_name: payload.name || getRecordTypeName(type),
		category_can_consume: type !== 'deposit',
		note: String(payload.note || '').trim(),
		occurred_at: Number(payload.occurredAt || createdAt),
		created_at: createdAt,
		updated_at: createdAt
	};
	const res = await recordsCollection.add(record);
	return ok({ id: res.id });
}

function getRecordTypeName(type) {
	return {
		income: '收入',
		expense: '支出',
		deposit: '存款'
	}[type] || '记录';
}

async function listRecords(payload = {}) {
	const limit = Math.min(Number(payload.limit || 100), 200);
	const startAt = Number(payload.startAt || 0);
	const endAt = Number(payload.endAt || 0);
	const res = await recordsCollection
		.orderBy('occurred_at', 'desc')
		.orderBy('created_at', 'desc')
		.limit(1000)
		.get();
	const records = (res.data || [])
		.filter((record) => (!startAt || record.occurred_at >= startAt) && (!endAt || record.occurred_at < endAt))
		.slice(0, limit);
	return ok({ records });
}

async function getSummary(payload = {}) {
	const recordsRes = await recordsCollection.limit(1000).get();
	const records = recordsRes.data || [];

	const startAt = Number(payload.startAt || payload.monthStart || 0);
	const endAt = Number(payload.endAt || payload.monthEnd || 0);
	const totals = {
		income: 0,
		expense: 0,
		deposit: 0,
		consumableBalance: 0,
		protectedBalance: 0,
		periodIncome: 0,
		periodExpense: 0,
		periodDeposit: 0,
		periodNet: 0,
		monthExpense: 0,
		monthIncome: 0
	};
	const periodRecords = [];

	records.forEach((record) => {
		const amount = Number(record.amount || 0);
		const inPeriod = startAt && endAt && record.occurred_at >= startAt && record.occurred_at < endAt;

		if (record.type === 'income') {
			totals.income += amount;
			totals.consumableBalance += amount;
			if (inPeriod) totals.periodIncome += amount;
		}
		if (record.type === 'expense') {
			totals.expense += amount;
			totals.consumableBalance -= amount;
			if (inPeriod) totals.periodExpense += amount;
		}
		if (record.type === 'deposit') {
			totals.deposit += amount;
			totals.protectedBalance += amount;
			if (inPeriod) totals.periodDeposit += amount;
		}
		if (inPeriod) {
			periodRecords.push(record);
		}
	});
	totals.monthIncome = totals.periodIncome;
	totals.monthExpense = totals.periodExpense;
	totals.periodNet = totals.periodIncome - totals.periodExpense + totals.periodDeposit;

	return ok({
		totals,
		periodRecords
	});
}

exports.main = async (event = {}) => {
	const { action, payload = {}, token } = event;
	try {
		if (action === 'getAuthState') return await getAuthState();
		if (action === 'setupPassword') return await setupPassword(payload);
		if (action === 'login') return await login(payload);
		if (action === 'verifyToken') return await verifyToken({ token: payload.token || token });

		await requireAuth(payload.token || token);

		if (action === 'createRecord') return await createRecord(payload);
		if (action === 'listRecords') return await listRecords(payload);
		if (action === 'getSummary') return await getSummary(payload);

		return fail('未知操作');
	} catch (e) {
		console.error('[money-api]', action, e);
		return fail(e.message || e.errMsg || JSON.stringify(e) || '服务异常');
	}
};
