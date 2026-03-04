const initialMembers = [
  {
    id: 1,
    pensionerNo: '233242319364',
    pensionCardNo: 'PC-100923',
    name: 'U Aung Kyaw',
    nrcNo: '12/KAMANA(N)123456',
    relationship: 'Self',
    status: 'APPROVED',
    ticks: 0,
  },
  {
    id: 2,
    pensionerNo: '233242319365',
    pensionCardNo: 'PC-100924',
    name: 'Daw Hla Hla',
    nrcNo: '8/YAKANA(N)287654',
    relationship: 'Daughter',
    status: 'PENDING',
    ticks: 0,
  },
  {
    id: 3,
    pensionerNo: '233242319366',
    pensionCardNo: 'PC-100925',
    name: 'U Min Zaw',
    nrcNo: '9/MAKANA(N)443322',
    relationship: 'Son',
    status: 'UNDER REVIEW',
    ticks: 1,
  },
]

let memberStore = [...initialMembers]

const pensionAmount = 400000
const allowanceAmount = 50000

const randomCode = (min = 100000, max = 999999) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const maybeNetworkIssue = () => {
  if (typeof window === 'undefined') return
  if (window.__KBZ_FORCE_API_FAILURE__ === true) {
    throw new Error('Network is unstable. Please try again.')
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value))

export const mockApi = {
  async requestOtp({ pensionerNo, pensionCardNo }) {
    await wait(750)
    maybeNetworkIssue()

    if (!pensionerNo || !pensionCardNo) {
      throw new Error('Missing pensioner identity details.')
    }

    return {
      otpToken: `OTP-${Date.now()}-${randomCode(100, 999)}`,
      otpCode: String(randomCode()),
      expiresInSeconds: 120,
    }
  },

  async verifyOtp({ otpCode, inputOtp }) {
    await wait(550)
    maybeNetworkIssue()

    if (otpCode !== inputOtp) {
      throw new Error('OTP verification failed.')
    }

    return { verified: true }
  },

  async verifyFace() {
    await wait(900)
    maybeNetworkIssue()
    return { verified: true }
  },

  async submitWithdrawal({ profile }) {
    await wait(850)
    maybeNetworkIssue()

    const grossAmount = pensionAmount + allowanceAmount
    const fee = Math.round(grossAmount * 0.01)

    return {
      orderNo: `OD-${randomCode(100000, 999999)}`,
      paymentDate: 'For 9 months',
      pensionAmount,
      allowanceAmount,
      fee,
      totalPayment: grossAmount - fee,
      profile,
      timestamp: new Date().toISOString(),
    }
  },

  async fetchRepresentativeMembers() {
    await wait(600)
    maybeNetworkIssue()
    return clone(memberStore)
  },

  async submitRepresentativeRequest(payload) {
    await wait(900)
    maybeNetworkIssue()

    const newMember = {
      id: Date.now(),
      ...payload,
      status: 'PENDING',
      ticks: 0,
    }

    memberStore = [newMember, ...memberStore]
    return clone(newMember)
  },

  async pollRepresentativeStatuses() {
    await wait(350)
    memberStore = memberStore.map((member) => {
      if (member.status === 'PENDING') {
        const nextTicks = member.ticks + 1
        if (nextTicks >= 2) {
          return { ...member, status: 'UNDER REVIEW', ticks: nextTicks }
        }
        return { ...member, ticks: nextTicks }
      }

      if (member.status === 'UNDER REVIEW') {
        const nextTicks = member.ticks + 1
        if (nextTicks >= 4) {
          return { ...member, status: 'APPROVED', ticks: nextTicks }
        }
        return { ...member, ticks: nextTicks }
      }

      return member
    })

    return clone(memberStore)
  },
}
