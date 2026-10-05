// Express 4 ไม่จับ promise rejection ของ async handler: error ที่หลุดจะกลายเป็น unhandledRejection
// และ Node 15+ จะปิดโปรเซสทั้งตัว (ทุกคนใช้งานไม่ได้) ครอบ handler ทุกตัวให้ส่ง error เข้า error middleware แทน
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const wrap = (handler) => {
    if (typeof handler !== 'function' || handler.length >= 4) return handler; // ข้าม error middleware (4 args)
    return (req, res, next) => {
        try {
            const result = handler(req, res, next);
            if (result && typeof result.catch === 'function') result.catch(next);
        } catch (error) {
            next(error);
        }
    };
};

function withAsyncErrors(router) {
    for (const method of METHODS) {
        const original = router[method].bind(router);
        router[method] = (path, ...handlers) => original(path, ...handlers.map(wrap));
    }
    return router;
}

module.exports = { withAsyncErrors, wrap };
