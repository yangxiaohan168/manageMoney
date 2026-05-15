'use strict';

const crypto = require('crypto');
const db = uniCloud.database();
const settingsCollection = db.collection('money-settings');
const recordsCollection = db.collection('money-records');
const humanRecordsCollection = db.collection('money-human-records');
const friendsCollection = db.collection('money-friends');

const SETTINGS_KEY = 'default';
const TOKEN_MAX_AGE = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_CYCLE_START_DAY = 5;
const DEFAULT_SALARY_AMOUNT = 927000;

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

function normalizeCycleStartDay(value) {
	const day = Math.round(Number(value || DEFAULT_CYCLE_START_DAY));
	if (!Number.isFinite(day) || day < 1 || day > 31) {
		throw new Error('月起始日必须是 1-31');
	}
	return day;
}

function getConfigFromSetting(setting = {}) {
	return {
		cycleStartDay: normalizeCycleStartDay(setting.cycle_start_day || DEFAULT_CYCLE_START_DAY),
		salaryAmount: Number(setting.salary_amount || DEFAULT_SALARY_AMOUNT)
	};
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
		cycle_start_day: DEFAULT_CYCLE_START_DAY,
		salary_amount: DEFAULT_SALARY_AMOUNT,
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

async function getBookConfig() {
	const setting = await getSetting();
	return ok(getConfigFromSetting(setting || {}));
}

async function updateBookConfig(payload = {}) {
	const setting = await getSetting();
	if (!setting || !setting._id) return fail('请先设置管理密码');

	const currentConfig = getConfigFromSetting(setting);
	let cycleStartDay = currentConfig.cycleStartDay;
	let salaryAmount = currentConfig.salaryAmount;
	try {
		if (payload.cycleStartDay !== undefined && payload.cycleStartDay !== null && payload.cycleStartDay !== '') {
			cycleStartDay = normalizeCycleStartDay(payload.cycleStartDay);
		}
		if (payload.salaryAmount !== undefined && payload.salaryAmount !== null && payload.salaryAmount !== '') {
			salaryAmount = normalizeAmountToCents(payload.salaryAmount);
		}
	} catch (e) {
		return fail(e.message);
	}

	await settingsCollection.doc(setting._id).update({
		cycle_start_day: cycleStartDay,
		salary_amount: salaryAmount,
		updated_at: now()
	});
	return ok({ cycleStartDay, salaryAmount });
}

async function createRecord(payload = {}) {
	const type = payload.type;
	if (!['income', 'expense', 'deposit', 'advance'].includes(type)) {
		return fail('记录类型不正确');
	}
	const name = String(payload.name || '').trim();
	if (!name) {
		return fail('请输入记录名');
	}

	let amount = 0;
	try {
		amount = normalizeAmountToCents(payload.amount);
	} catch (e) {
		return fail(e.message);
	}

	const createdAt = now();
	const record = {
		type,
		name,
		amount,
		note: String(payload.note || '').trim(),
		occurred_at: Number(payload.occurredAt || createdAt),
		created_at: createdAt,
		updated_at: createdAt
	};
	const res = await recordsCollection.add(record);
	return ok({ id: res.id });
}

async function updateRecord(payload = {}) {
	const id = String(payload.id || '').trim();
	if (!id) return fail('记录ID不能为空');
	const type = payload.type;
	if (!['income', 'expense', 'deposit', 'advance'].includes(type)) {
		return fail('记录类型不正确');
	}
	const name = String(payload.name || '').trim();
	if (!name) return fail('请输入记录名');

	let amount = 0;
	try {
		amount = normalizeAmountToCents(payload.amount);
	} catch (e) {
		return fail(e.message);
	}

	const occurredAt = Number(payload.occurredAt || 0);
	const updateData = {
		type,
		name,
		amount,
		note: String(payload.note || '').trim(),
		updated_at: now()
	};
	if (Number.isFinite(occurredAt) && occurredAt > 0) {
		updateData.occurred_at = occurredAt;
	}
	await recordsCollection.doc(id).update(updateData);
	return ok({ id });
}

async function deleteRecord(payload = {}) {
	const id = String(payload.id || '').trim();
	if (!id) return fail('记录ID不能为空');
	await recordsCollection.doc(id).remove();
	return ok({ id });
}

async function listFriends() {
	const res = await friendsCollection.orderBy('updated_at', 'desc').orderBy('created_at', 'desc').limit(500).get();
	return ok({ friends: res.data || [] });
}

async function upsertFriend(payload = {}) {
	const id = String(payload.id || '').trim();
	const name = String(payload.name || '').trim();
	if (!name) return fail('请输入朋友名称');
	const note = String(payload.note || '').trim();
	const ts = now();
	if (id) {
		await friendsCollection.doc(id).update({ name, note, updated_at: ts });
		return ok({ id });
	}
	const exists = await friendsCollection.where({ name }).limit(1).get();
	if (exists.data && exists.data[0]) return fail('朋友名称已存在');
	const res = await friendsCollection.add({ name, note, created_at: ts, updated_at: ts });
	return ok({ id: res.id });
}

async function deleteFriend(payload = {}) {
	const id = String(payload.id || '').trim();
	if (!id) return fail('朋友ID不能为空');
	await friendsCollection.doc(id).remove();
	return ok({ id });
}

async function createHumanRecord(payload = {}) {
	const friendId = String(payload.friendId || '').trim();
	const friendName = String(payload.friendName || '').trim();
	const type = payload.type;
	if (!friendId || !friendName) return fail('请选择朋友');
	if (!['human_income', 'human_expense'].includes(type)) return fail('记录类型不正确');
	let amount = 0;
	try {
		amount = normalizeAmountToCents(payload.amount);
	} catch (e) {
		return fail(e.message);
	}
	const ts = now();
	const record = {
		friend_id: friendId,
		friend_name: friendName,
		type,
		amount,
		note: String(payload.note || '').trim(),
		occurred_at: Number(payload.occurredAt || ts),
		created_at: ts,
		updated_at: ts
	};
	const res = await humanRecordsCollection.add(record);
	return ok({ id: res.id });
}

async function updateHumanRecord(payload = {}) {
	const id = String(payload.id || '').trim();
	if (!id) return fail('记录ID不能为空');
	const friendId = String(payload.friendId || '').trim();
	const friendName = String(payload.friendName || '').trim();
	const type = payload.type;
	if (!friendId || !friendName) return fail('请选择朋友');
	if (!['human_income', 'human_expense'].includes(type)) return fail('记录类型不正确');
	let amount = 0;
	try {
		amount = normalizeAmountToCents(payload.amount);
	} catch (e) {
		return fail(e.message);
	}
	const occurredAt = Number(payload.occurredAt || 0);
	const updateData = {
		friend_id: friendId,
		friend_name: friendName,
		type,
		amount,
		note: String(payload.note || '').trim(),
		updated_at: now()
	};
	if (Number.isFinite(occurredAt) && occurredAt > 0) updateData.occurred_at = occurredAt;
	await humanRecordsCollection.doc(id).update(updateData);
	return ok({ id });
}

async function deleteHumanRecord(payload = {}) {
	const id = String(payload.id || '').trim();
	if (!id) return fail('记录ID不能为空');
	await humanRecordsCollection.doc(id).remove();
	return ok({ id });
}

async function listHumanRecords(payload = {}) {
	const pageSize = Math.min(Math.max(Number(payload.pageSize) || 10, 1), 50);
	const page = Math.max(Number(payload.page) || 1, 1);
	const skip = (page - 1) * pageSize;
	const friendId = String(payload.friendId || '').trim();
	const cond = {};
	if (friendId) cond.friend_id = friendId;
	const condKeys = Object.keys(cond);
	const base = condKeys.length ? humanRecordsCollection.where(cond) : humanRecordsCollection;
	const countRes = await base.count();
	const total = countRes.total || 0;
	const res = await (condKeys.length ? humanRecordsCollection.where(cond) : humanRecordsCollection)
		.orderBy('occurred_at', 'desc')
		.orderBy('created_at', 'desc')
		.skip(skip)
		.limit(pageSize)
		.get();
	const records = res.data || [];
	return ok({ records, total, page, pageSize, hasMore: skip + records.length < total });
}

async function getHumanSummary() {
	const $ = db.command.aggregate;
	const sumType = (type) =>
		humanRecordsCollection
			.aggregate()
			.match({ type })
			.group({ _id: null, sum: $.sum('$amount') })
			.end();
	const [inRes, outRes] = await Promise.all([sumType('human_income'), sumType('human_expense')]);
	const pick = (res) => ((res.data && res.data[0]) ? Number(res.data[0].sum || 0) : 0);
	const income = pick(inRes);
	const expense = pick(outRes);
	return ok({ totals: { income, expense, net: income - expense } });
}

async function listRecords(payload = {}) {
	const pageSize = Math.min(Math.max(Number(payload.pageSize) || 10, 1), 50);
	const page = Math.max(Number(payload.page) || 1, 1);
	const skip = (page - 1) * pageSize;

	const types = payload.types;
	const startAt = Number(payload.startAt || 0);
	const endAt = Number(payload.endAt || 0);

	const _ = db.command;
	const cond = {};

	if (Array.isArray(types) && types.length > 0) {
		cond.type = types.length === 1 ? types[0] : _.in(types);
	}
	if (startAt && endAt) {
		cond.occurred_at = _.gte(startAt).and(_.lt(endAt));
	}

	const condKeys = Object.keys(cond);
	const base = condKeys.length > 0 ? recordsCollection.where(cond) : recordsCollection;

	const countRes = await base.count();
	const total = countRes.total || 0;

	const res = await (condKeys.length > 0 ? recordsCollection.where(cond) : recordsCollection)
		.orderBy('occurred_at', 'desc')
		.orderBy('created_at', 'desc')
		.skip(skip)
		.limit(pageSize)
		.get();

	const records = res.data || [];
	const hasMore = skip + records.length < total;

	return ok({
		records,
		total,
		page,
		pageSize,
		hasMore
	});
}

async function sumRecordsByTypeAndRange(type, startAt, endAt) {
	const $ = db.command.aggregate;
	const _ = db.command;
	const res = await recordsCollection
		.aggregate()
		.match({
			type,
			occurred_at: _.gte(startAt).and(_.lt(endAt))
		})
		.group({
			_id: null,
			sum: $.sum('$amount')
		})
		.end();
	const row = res.data && res.data[0];
	return row ? Number(row.sum || 0) : 0;
}

async function sumHumanRecordsByTypeAndRange(type, startAt, endAt) {
	const $ = db.command.aggregate;
	const _ = db.command;
	const res = await humanRecordsCollection
		.aggregate()
		.match({
			type,
			occurred_at: _.gte(startAt).and(_.lt(endAt))
		})
		.group({
			_id: null,
			sum: $.sum('$amount')
		})
		.end();
	const row = res.data && res.data[0];
	return row ? Number(row.sum || 0) : 0;
}

function normalizeMonthlyEntry(record, source) {
	if (source === 'human') {
		return {
			...record,
			source,
			name: record.friend_name || '人情记录'
		};
	}
	return { ...record, source };
}

async function listMonthlyEntries(payload = {}) {
	const pageSize = Math.min(Math.max(Number(payload.pageSize) || 10, 1), 50);
	const page = Math.max(Number(payload.page) || 1, 1);
	const skip = (page - 1) * pageSize;
	const startAt = Number(payload.startAt || 0);
	const endAt = Number(payload.endAt || 0);
	if (!startAt || !endAt || endAt <= startAt) return fail('周期范围不正确');

	const _ = db.command;
	const range = { occurred_at: _.gte(startAt).and(_.lt(endAt)) };
	const fetchLimit = skip + pageSize;
	const recordCond = { type: _.in(['income', 'expense', 'deposit']), ...range };
	const humanCond = { type: _.in(['human_income', 'human_expense']), ...range };

	const [recordCountRes, humanCountRes, recordRes, humanRes] = await Promise.all([
		recordsCollection.where(recordCond).count(),
		humanRecordsCollection.where(humanCond).count(),
		recordsCollection
			.where(recordCond)
			.orderBy('occurred_at', 'desc')
			.orderBy('created_at', 'desc')
			.limit(fetchLimit)
			.get(),
		humanRecordsCollection
			.where(humanCond)
			.orderBy('occurred_at', 'desc')
			.orderBy('created_at', 'desc')
			.limit(fetchLimit)
			.get()
	]);

	const merged = [
		...(recordRes.data || []).map((item) => normalizeMonthlyEntry(item, 'record')),
		...(humanRes.data || []).map((item) => normalizeMonthlyEntry(item, 'human'))
	].sort((a, b) => {
		const occurredDiff = Number(b.occurred_at || 0) - Number(a.occurred_at || 0);
		if (occurredDiff) return occurredDiff;
		const createdDiff = Number(b.created_at || 0) - Number(a.created_at || 0);
		if (createdDiff) return createdDiff;
		return String(b._id || '').localeCompare(String(a._id || ''));
	});

	const total = Number(recordCountRes.total || 0) + Number(humanCountRes.total || 0);
	const entries = merged.slice(skip, skip + pageSize);
	return ok({ entries, records: entries, total, page, pageSize, hasMore: skip + entries.length < total });
}

async function getRangeStats(payload = {}) {
	const ranges = Array.isArray(payload.ranges) ? payload.ranges.slice(0, 31) : [];
	if (!ranges.length) return ok({ ranges: [] });

	const normalizedRanges = ranges
		.map((item) => {
			const startAt = Number(item.startAt || 0);
			const endAt = Number(item.endAt || 0);
			return {
				key: String(item.key || startAt),
				label: String(item.label || ''),
				startAt,
				endAt
			};
		})
		.filter((item) => item.startAt > 0 && item.endAt > item.startAt);

	const rows = await Promise.all(
		normalizedRanges.map(async (range) => {
			const [income, expense, deposit, humanIncome, humanExpense] = await Promise.all([
				sumRecordsByTypeAndRange('income', range.startAt, range.endAt),
				sumRecordsByTypeAndRange('expense', range.startAt, range.endAt),
				sumRecordsByTypeAndRange('deposit', range.startAt, range.endAt),
				sumHumanRecordsByTypeAndRange('human_income', range.startAt, range.endAt),
				sumHumanRecordsByTypeAndRange('human_expense', range.startAt, range.endAt)
			]);
			return {
				...range,
				income: income + humanIncome,
				expense: expense + humanExpense + deposit,
				deposit,
				recordIncome: income,
				recordExpense: expense,
				humanIncome,
				humanExpense
			};
		})
	);

	return ok({ ranges: rows, days: rows });
}

async function getDailyStats(payload = {}) {
	const days = Array.isArray(payload.days) ? payload.days.slice(0, 31) : [];
	if (!days.length) return ok({ days: [] });
	const includeHuman = !!payload.includeHuman;

	const normalizedDays = days
		.map((item) => {
			const startAt = Number(item.startAt || 0);
			const endAt = Number(item.endAt || 0);
			return {
				key: String(item.key || startAt),
				label: String(item.label || ''),
				startAt,
				endAt
			};
		})
		.filter((item) => item.startAt > 0 && item.endAt > item.startAt);

	const rows = await Promise.all(
		normalizedDays.map(async (day) => {
			const [income, expense, deposit, humanIncome, humanExpense] = await Promise.all([
				sumRecordsByTypeAndRange('income', day.startAt, day.endAt),
				sumRecordsByTypeAndRange('expense', day.startAt, day.endAt),
				sumRecordsByTypeAndRange('deposit', day.startAt, day.endAt),
				includeHuman ? sumHumanRecordsByTypeAndRange('human_income', day.startAt, day.endAt) : 0,
				includeHuman ? sumHumanRecordsByTypeAndRange('human_expense', day.startAt, day.endAt) : 0
			]);
			return { ...day, income: income + humanIncome, expense: expense + humanExpense + deposit, deposit };
		})
	);

	return ok({ days: rows });
}

async function getSummary(payload = {}) {
	const startAt = Number(payload.startAt || payload.monthStart || 0);
	const endAt = Number(payload.endAt || payload.monthEnd || 0);
	const hasPeriod = startAt > 0 && endAt > startAt;
	const includeNameStats = !!payload.includeNameStats;

	const $ = db.command.aggregate;
	const _ = db.command;
	let nameStats = [];

	const totals = {
		deposit: 0,
		periodIncome: 0,
		periodExpense: 0,
		periodDeposit: 0,
		periodAdvance: 0,
		periodNet: 0
	};

	const depositAllRes = await recordsCollection
		.aggregate()
		.match({ type: 'deposit' })
		.group({
			_id: null,
			sum: $.sum('$amount')
		})
		.end();

	const depositAllRow = depositAllRes.data && depositAllRes.data[0];
	if (depositAllRow) {
		totals.deposit = Number(depositAllRow.sum || 0);
	}

	if (hasPeriod) {
		const range = { occurred_at: _.gte(startAt).and(_.lt(endAt)) };
		const sumType = (type) =>
			recordsCollection
				.aggregate()
				.match({ type, ...range })
				.group({
					_id: null,
					sum: $.sum('$amount')
				})
				.end();

		const [incRes, expRes, depRes, advanceRes, humanIncome, humanExpense] = await Promise.all([
			sumType('income'),
			sumType('expense'),
			sumType('deposit'),
			sumType('advance'),
			sumHumanRecordsByTypeAndRange('human_income', startAt, endAt),
			sumHumanRecordsByTypeAndRange('human_expense', startAt, endAt)
		]);

		const pick = (res) => {
			const row = res.data && res.data[0];
			return row ? Number(row.sum || 0) : 0;
		};
		totals.periodIncome = pick(incRes) + humanIncome;
		totals.periodExpense = pick(expRes) + humanExpense + pick(depRes);
		totals.periodDeposit = pick(depRes);
		totals.periodAdvance = pick(advanceRes);

		if (includeNameStats) {
			const statsRes = await recordsCollection
				.aggregate()
				.match(range)
				.group({
					_id: {
						type: '$type',
						name: '$name'
					},
					amount: $.sum('$amount'),
					count: $.sum(1)
				})
				.end();

			const rows = (statsRes.data || [])
				.map((row) => {
					const id = row._id || {};
					const type = id.type || 'record';
					const name = id.name || '未命名';
					return {
						key: `${type}:${name}`,
						name,
						type,
						amount: Number(row.amount || 0),
						count: Number(row.count || 0)
					};
				})
				.filter((row) => row.amount > 0);

			rows.sort((a, b) => b.amount - a.amount);
			nameStats = rows.slice(0, 8);

			const otherRows = rows.slice(8);
			if (otherRows.length) {
				nameStats.push({
					key: 'other',
					name: '其他',
					type: 'other',
					amount: otherRows.reduce((sum, row) => sum + row.amount, 0),
					count: otherRows.reduce((sum, row) => sum + row.count, 0)
				});
			}
		}
	}

	totals.periodNet = totals.periodIncome - totals.periodExpense;
	const data = { totals };
	if (includeNameStats) data.nameStats = nameStats;
	return ok(data);
}

exports.main = async (event = {}) => {
	const { action, payload = {}, token } = event;
	try {
		if (action === 'getAuthState') return await getAuthState();
		if (action === 'setupPassword') return await setupPassword(payload);
		if (action === 'login') return await login(payload);
		if (action === 'verifyToken') return await verifyToken({ token: payload.token || token });

		await requireAuth(payload.token || token);

		if (action === 'getBookConfig') return await getBookConfig();
		if (action === 'updateBookConfig') return await updateBookConfig(payload);
		if (action === 'createRecord') return await createRecord(payload);
		if (action === 'updateRecord') return await updateRecord(payload);
		if (action === 'deleteRecord') return await deleteRecord(payload);
		if (action === 'listRecords') return await listRecords(payload);
		if (action === 'listMonthlyEntries') return await listMonthlyEntries(payload);
		if (action === 'getRangeStats') return await getRangeStats(payload);
		if (action === 'getDailyStats') return await getDailyStats(payload);
		if (action === 'getSummary') return await getSummary(payload);
		if (action === 'listFriends') return await listFriends();
		if (action === 'upsertFriend') return await upsertFriend(payload);
		if (action === 'deleteFriend') return await deleteFriend(payload);
		if (action === 'createHumanRecord') return await createHumanRecord(payload);
		if (action === 'updateHumanRecord') return await updateHumanRecord(payload);
		if (action === 'deleteHumanRecord') return await deleteHumanRecord(payload);
		if (action === 'listHumanRecords') return await listHumanRecords(payload);
		if (action === 'getHumanSummary') return await getHumanSummary();

		return fail('未知操作');
	} catch (e) {
		console.error('[money-api]', action, e);
		return fail(e.message || e.errMsg || JSON.stringify(e) || '服务异常');
	}
};
