const JSONBIN_BASE = "https://api.jsonbin.io/v3/b";
const { isAuthenticated } = require("./lib/session");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Cache-Control": "no-store",
  "Vary": "Cookie",
  "Content-Type": "application/json; charset=utf-8"
};
const reply = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
const normalize = value => String(value ?? "").trim();
const firstValue = (...values) => {
  for (const value of values) {
    const text = normalize(value);
    if (text) return text;
  }
  return "";
};
const normalizeStatus = value => {
  const status = normalize(value).toLowerCase();
  const aliases = {
    "جديد": "new",
    "قيد المراجعة": "review",
    "بانتظار الاستكمال": "missing",
    "موافقة نهائية": "approved",
    "معتمد": "approved",
    "مرفوض": "rejected"
  };
  return aliases[status] || status || "new";
};

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };

  const binId = process.env.JSONBIN_BIN_ID;
  const masterKey = process.env.JSONBIN_MASTER_KEY;
  if (!binId || !masterKey) return reply(500, { message: "إعدادات JSONBin غير مكتملة على الخادم." });

  const sessionSecret = process.env.HAMAH_SESSION_SECRET;
  const requireAdmin = () => isAuthenticated(event, sessionSecret);
  const binUrl = `${JSONBIN_BASE}/${encodeURIComponent(binId)}`;

  const readBin = async () => {
    const response = await fetch(`${binUrl}/latest`, { headers: { "X-Master-Key": masterKey } });
    if (!response.ok) throw new Error(`JSONBin read failed (${response.status})`);
    const payload = await response.json();
    const record = payload.record || {};
    return Array.isArray(record.applications) ? record : { ...record, applications: [] };
  };

  try {
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const outgoingNumber = normalize(body.outgoingNumber);
      const identity = normalize(body.identity);
      if (!/^\d{6}$/.test(outgoingNumber) || !identity) {
        return reply(400, { message: "يرجى إدخال رقم صادر صحيح ورقم الهوية أو السجل." });
      }

      const data = await readBin();
      const match = data.applications.find(item => {
        const storedOutgoing = firstValue(item.id, item.outgoingNumber, item.referenceNumber, item.serialNumber);
        const storedIdentity = firstValue(item.idNumber, item.identityNumber, item.nationalId, item.identity, item.registryNumber, item.commercialRegistration);
        return storedOutgoing === outgoingNumber && storedIdentity === identity;
      });

      if (!match) {
        return reply(404, { message: "لم يتم العثور على سجل مطابق. تأكد من حفظ الطلب في قاعدة البيانات وأن رقم الهوية مسجل معه." });
      }

      // Public response allowlist only. Never return phone, email, identity, documents,
      // reviewer, employer, income, or internal notes to the public inquiry page.
      const record = {
        id: firstValue(match.id, match.outgoingNumber, match.referenceNumber, match.serialNumber),
        clientName: firstValue(match.clientName, match.applicantName, match.customerName),
        entityType: firstValue(match.entityType, "فرد"),
        entityName: firstValue(match.entityName, match.businessName),
        businessActivity: firstValue(match.businessActivity, match.activityType),
        serviceType: firstValue(match.serviceType, match.service, match.requestType),
        commercialRegistration: firstValue(match.commercialRegistration, match.registryNumber),
        serviceName: firstValue(match.serviceName, match.productName),
        createdAt: firstValue(match.createdAt, match.requestDate, match.createdDate),
        status: normalizeStatus(match.status),
        approvalNo: firstValue(match.approvalNo, match.approvalNumber, match.approvalReference),
        approvedAmount: match.approvedAmount ?? match.finalAmount ?? match.approvedValue ?? null,
        currency: firstValue(match.currency, "ريال سعودي"),
        approvedTerm: firstValue(match.approvedTerm, match.approvedDuration, match.finalTerm),
        approvedAt: firstValue(match.approvedAt, match.approvalDate, match.decisionDate),
        approvalTerms: firstValue(match.approvalTerms, match.decisionTerms, match.decisionConditions, match.publicConditions),
        decisionNotice: firstValue(match.decisionNotice, "إشعار اعتماد القرار الصادر"),
        electronicSeal: firstValue(match.electronicSeal, "ختم إلكتروني توثيقي للمنصة")
      };
      return reply(200, { record });
    }

    if (event.httpMethod === "GET") {
      if (!requireAdmin()) return reply(401, { message: "غير مصرح. تحقق من رمز إدارة API." });
      return reply(200, await readBin());
    }

    if (event.httpMethod === "PUT") {
      if (!requireAdmin()) return reply(401, { message: "غير مصرح. تحقق من رمز إدارة API." });
      const body = JSON.parse(event.body || "{}");
      if (!Array.isArray(body.applications)) return reply(400, { message: "صيغة البيانات غير صحيحة." });
      if (body.applications.length > 5000) return reply(413, { message: "عدد السجلات يتجاوز الحد المسموح." });
      if (body.applications.some(item => !item || typeof item !== "object" || Array.isArray(item))) return reply(400, { message: "يوجد سجل غير صالح ضمن البيانات." });
      const current = await readBin();
      const response = await fetch(binUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Master-Key": masterKey },
        body: JSON.stringify({ ...current, applications: body.applications })
      });
      if (!response.ok) return reply(502, { message: "تعذر حفظ البيانات في JSONBin. تحقق من صلاحيات المفتاح." });
      return reply(200, { ok: true });
    }

    return reply(405, { message: "Method not allowed" });
  } catch (error) {
    return reply(502, { message: "تعذر الاتصال بقاعدة البيانات. تحقق من Bin ID وMaster Key وإعدادات JSONBin." });
  }
};
