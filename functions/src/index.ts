import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

admin.initializeApp()

interface FilledField {
  label: string
  value: string
}

interface FillResponse {
  fields: FilledField[]
  summary: string
}

export const demoFill = onCall(async (request: CallableRequest) => {
  const profile  = request.data?.profile  as string | undefined
  const document = request.data?.document as string | undefined

  if (!profile || !document) {
    throw new HttpsError('invalid-argument', 'Profile and document are required.')
  }

  const fields: FilledField[] = []

  const patterns: { label: string; regex: RegExp }[] = [
    { label: 'Full Name',     regex: /my name is ([A-Z][a-z]+ [A-Z][a-z]+)/i },
    { label: 'Address',       regex: /(?:live at|address is) ([^\.,]+)/i },
    { label: 'Phone',         regex: /(?:phone|cell|mobile)(?: is| number is)? ([\d\s\(\)\-\+\.]{7,})/i },
    { label: 'Email',         regex: /(?:email)(?: is)? ([\w\.\-]+@[\w\.\-]+\.[a-z]{2,})/i },
    { label: 'Date of Birth', regex: /born ([A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i },
    { label: 'Employer',      regex: /(?:work at|work for|employed at|employer is) ([^\.,]+)/i },
    { label: 'Job Title',     regex: /(?:work as a?|job title is|position is) ([^\.,]+)/i },
    { label: 'Annual Salary', regex: /earning \$?([\d,]+)/i },
    { label: 'City',          regex: /(?:in|city of) ([A-Z][a-z]+(?:,\s*[A-Z]{2})?)/i },
  ]

  patterns.forEach(({ label, regex }) => {
    const match = profile.match(regex)
    if (match?.[1]) {
      fields.push({ label, value: match[1].trim() })
    }
  })

  if (fields.length === 0) {
    fields.push({
      label: 'Profile Summary',
      value: profile.slice(0, 120) + '...',
    })
  }

  const result: FillResponse = {
    fields,
    summary: `Found ${fields.length} field(s) from your profile.`,
  }
  return result
})

export const saveProfile = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const text = request.data?.text as string | undefined
  if (!text) {
    throw new HttpsError('invalid-argument', 'Profile text is required.')
  }

  const db = admin.firestore()
  await db.doc(`profiles/${request.auth.uid}`).set({
    text,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { success: true }
})