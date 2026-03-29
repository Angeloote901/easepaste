"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveProfile = exports.demoFill = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
exports.demoFill = (0, https_1.onCall)(async (request) => {
    const profile = request.data?.profile;
    const document = request.data?.document;
    if (!profile || !document) {
        throw new https_1.HttpsError('invalid-argument', 'Profile and document are required.');
    }
    const fields = [];
    const patterns = [
        { label: 'Full Name', regex: /my name is ([A-Z][a-z]+ [A-Z][a-z]+)/i },
        { label: 'Address', regex: /(?:live at|address is) ([^\.,]+)/i },
        { label: 'Phone', regex: /(?:phone|cell|mobile)(?: is| number is)? ([\d\s\(\)\-\+\.]{7,})/i },
        { label: 'Email', regex: /(?:email)(?: is)? ([\w\.\-]+@[\w\.\-]+\.[a-z]{2,})/i },
        { label: 'Date of Birth', regex: /born ([A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i },
        { label: 'Employer', regex: /(?:work at|work for|employed at|employer is) ([^\.,]+)/i },
        { label: 'Job Title', regex: /(?:work as a?|job title is|position is) ([^\.,]+)/i },
        { label: 'Annual Salary', regex: /earning \$?([\d,]+)/i },
        { label: 'City', regex: /(?:in|city of) ([A-Z][a-z]+(?:,\s*[A-Z]{2})?)/i },
    ];
    patterns.forEach(({ label, regex }) => {
        const match = profile.match(regex);
        if (match?.[1]) {
            fields.push({ label, value: match[1].trim() });
        }
    });
    if (fields.length === 0) {
        fields.push({
            label: 'Profile Summary',
            value: profile.slice(0, 120) + '...',
        });
    }
    const result = {
        fields,
        summary: `Found ${fields.length} field(s) from your profile.`,
    };
    return result;
});
exports.saveProfile = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const text = request.data?.text;
    if (!text) {
        throw new https_1.HttpsError('invalid-argument', 'Profile text is required.');
    }
    const db = admin.firestore();
    await db.doc(`profiles/${request.auth.uid}`).set({
        text,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=index.js.map