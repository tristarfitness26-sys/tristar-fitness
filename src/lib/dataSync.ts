import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { loadSyncedJSON } from './utils';

// Types
export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  membershipType: string;
  startDate: string;
  endDate: string;
  expiryDate?: string;  // Alias for endDate for backward compatibility
  status: 'active' | 'inactive' | 'expired' | 'pending';
  trainer?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  totalVisits?: number;
  lastVisit?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Invoice {
  id: string;
  memberId: string;
  memberName: string;
  amount: number; // kept for backward compatibility; equals total
  status: 'paid' | 'pending' | 'overdue';
  dueDate: string;
  paidDate?: string;
  description: string;
  createdAt: string;
  // Extended fields
  items?: InvoiceItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  notes?: string;
  updatedAt?: string;
  // Payments
  paidAmount?: number;
  amountRemaining?: number;
}

export interface FollowUp {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  interest: string;
  status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'converted';
  notes?: string;
  followUpDate: string;
  createdAt: string;
  updatedAt: string;
  // Extended fields
  age?: number;
  gender?: 'male' | 'female' | 'other';
  occupation?: string;
  address?: string;
  preferredTime?: string;
  budget?: number;
  goals?: string;
  experience?: 'beginner' | 'intermediate' | 'advanced';
  equipment?: string[];
  healthIssues?: string;
  bestTimeToContact?: string;
  followUpCount?: number;  // Track number of follow-up attempts
  lastContactAttempt?: string;
  conversionStatus?: 'new' | 'interested' | 'trial_scheduled' | 'trial_completed' | 'converted' | 'lost';
}

export interface Protein {
  id: string;
  name: string;
  basePrice: number;
  sellingPrice: number;
  quantityInStock: number;
  unitsSold: number;
  supplierName?: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
  // Calculated fields
  margin?: number;
  profit?: number;
}

export interface Activity {
  id: string;
  type: 'member' | 'invoice' | 'followup' | 'checkin';
  action: string;
  name: string;
  time: string;
  details: string;
  memberId?: string;
}

export interface CheckIn {
  id: string;
  memberId: string;
  memberName: string;
  checkInTime: string;
  date: string;
}

export interface PricingSettings {
  monthlyFee: number;
  quarterlyFee: number;
  halfYearlyFee: number;
  yearlyFee: number;
  personalTrainingFee: number;
}

// Store interface
interface DataStore {
  // State
  members: Member[];
  trainers: any[];
  visitors: any[];
  invoices: Invoice[];
  followUps: FollowUp[];
  activities: Activity[];
  checkIns: CheckIn[];
  proteins: Protein[];
  pricing: PricingSettings;
  termsAndConditions: string;
  lastInvoiceSequence: number;
  
  // Demo data initialization
  initializeDemoData: () => void;
  
  // Members
  addMember: (member: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateMember: (id: string, member: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  getMemberById: (id: string) => Member | undefined;
  
  // Invoices
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  getInvoiceById: (id: string) => Invoice | undefined;
  generateInvoiceNumber: () => string;
  
  // Follow-ups
  addFollowUp: (followUp: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateFollowUp: (id: string, followUp: Partial<FollowUp>) => void;
  deleteFollowUp: (id: string) => void;
  getFollowUpById: (id: string) => FollowUp | undefined;
  
  // Activities
  addActivity: (activity: Omit<Activity, 'id'>) => void;
  getActivitiesByType: (type: Activity['type']) => Activity[];
  
  // Check-ins
  addCheckIn: (checkIn: Omit<CheckIn, 'id'>) => void;
  getCheckInsByMember: (memberId: string) => CheckIn[];
  getCheckInsByDate: (date: string) => CheckIn[];
  
  // Visitors
  addVisitor: (visitor: any) => void;
  updateVisitor: (id: string, visitor: any) => void;
  
  // Proteins
  addProtein: (protein: Omit<Protein, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProtein: (id: string, protein: Partial<Protein>) => void;
  deleteProtein: (id: string) => void;
  getProteinById: (id: string) => Protein | undefined;
  recordProteinSale: (proteinId: string, unitsSold: number) => void;
  
  // Settings
  updatePricing: (pricing: Partial<PricingSettings>) => void;
  updateTermsAndConditions: (terms: string) => void;
  setPricing: (pricing: Partial<PricingSettings>) => void;
  setTermsAndConditions: (terms: string) => void;
  
  // Data management
  exportData: () => string;
  importData: (data: string) => void;
  clearAllData: () => void;
  refreshData: () => Promise<void>;
  
  // Auto-expire members
  autoExpireMembers: () => Promise<void>;
}

// Helper function to generate unique IDs
const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${timestamp}-${random}`;
};

// Store implementation
export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      // Initial state
      members: [],
      trainers: [],
      visitors: [],
      invoices: [],
      followUps: [],
      activities: [],
      checkIns: [],
      proteins: [],
      pricing: {
        monthlyFee: 1999,
        quarterlyFee: 5500,
        halfYearlyFee: 6999,
        yearlyFee: 8500,
        personalTrainingFee: 5500,
      },
      termsAndConditions: `TRI-STAR FITNESS TERMS AND CONDITIONS

1. MEMBERSHIP TERMS
   - All memberships are non-refundable
   - Membership fees must be paid in advance
   - Late payments may result in membership suspension

2. GYM RULES
   - Proper gym attire required
   - No food or drinks in workout areas
   - Equipment must be returned after use
   - Respect other members and staff

3. LIABILITY
   - Members use equipment at their own risk
   - Gym is not responsible for lost or stolen items
   - Medical clearance may be required for certain activities

4. CANCELLATION POLICY
   - 30 days notice required for membership cancellation
   - No refunds for unused membership time
   - Cancellation fees may apply

By signing up, you agree to these terms and conditions.`,
      lastInvoiceSequence: 0,

      // Initialize empty data store for production
      initializeDemoData: () => {
        // Only initialize if there's no existing data
        const currentState = get();
        if (currentState.members.length === 0 &&
            currentState.invoices.length === 0 &&
            currentState.followUps.length === 0) {
          const emptyData = {
            members: [],
            trainers: [],
            visitors: [],
            invoices: [],
            followUps: [],
            activities: [],
            checkIns: [],
            proteins: [],
          };
          set(emptyData);
          console.log('No existing data found: Initialized empty data store');
        } else {
          console.log('Existing data found: Skipping demo data initialization');
        }
      },

      // Members
      addMember: (member) => {
        const newMember: Member = {
          ...member,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
            set((state) => ({
          members: [...state.members, newMember],
              activities: [...state.activities, {
                id: generateId(),
                type: 'member',
            action: 'Added new member',
            name: newMember.name,
                time: new Date().toISOString(),
            details: `Added member ${newMember.name} with ${newMember.membershipType} membership`,
            memberId: newMember.id,
            }],
          }));
      },
      
      updateMember: (id, updates) => {
        set((state) => ({
          members: state.members.map((member) =>
            member.id === id
              ? { ...member, ...updates, updatedAt: new Date().toISOString() }
              : member
          ),
          activities: [...state.activities, {
            id: generateId(),
            type: 'member',
            action: 'Updated member',
            name: updates.name || state.members.find(m => m.id === id)?.name || 'Unknown',
            time: new Date().toISOString(),
            details: `Updated member information`,
            memberId: id,
          }],
        }));
      },
      
      deleteMember: (id) => {
        const member = get().members.find(m => m.id === id);
        set((state) => ({
          members: state.members.filter((member) => member.id !== id),
          activities: [...state.activities, {
            id: generateId(),
            type: 'member',
            action: 'Deleted member',
            name: member?.name || 'Unknown',
            time: new Date().toISOString(),
            details: `Deleted member ${member?.name}`,
            memberId: id,
          }],
        }));
      },
      
      getMemberById: (id) => {
        return get().members.find((member) => member.id === id);
      },

      // Invoices
      addInvoice: (invoice) => {
        // Use provided MP id if supplied; otherwise generate sequential MP0001-style id
        const providedId = (invoice as any).id as string | undefined;
        let nextSeq = get().lastInvoiceSequence + 1;
        let mpId = `MP${nextSeq.toString().padStart(4, '0')}`;
        if (providedId && /^MP(\d+)$/i.test(providedId)) {
          const match = providedId.match(/^MP(\d+)$/i)!;
          const seq = parseInt(match[1], 10) || nextSeq;
          mpId = `MP${seq.toString().padStart(4, '0')}`;
          nextSeq = Math.max(nextSeq, seq);
        }
        const newInvoice: Invoice = {
          ...invoice,
          id: mpId,
          amount: invoice.total ?? invoice.amount,
          paidAmount: (invoice as any).paidAmount ?? 0,
          amountRemaining: Math.max(0, (invoice.total ?? invoice.amount ?? 0) - ((invoice as any).paidAmount ?? 0)),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          invoices: [...state.invoices, newInvoice],
          lastInvoiceSequence: nextSeq,
          activities: [...state.activities, {
            id: generateId(),
            type: 'invoice',
            action: 'Created invoice',
            name: newInvoice.memberName,
            time: new Date().toISOString(),
            details: `Created invoice for ${newInvoice.memberName} - Amount: ₹${newInvoice.amount}`,
            memberId: newInvoice.memberId,
          }],
        }));
        return newInvoice;
      },
      
      updateInvoice: (id, updates) => {
        set((state) => ({
          invoices: state.invoices.map((invoice) =>
            invoice.id === id
              ? { 
                  ...invoice, 
                  ...updates, 
                  // auto-maintain remaining if paidAmount or total changes
                  amountRemaining: (() => {
                    const total = (updates.total ?? invoice.total ?? invoice.amount ?? 0) as number;
                    const paid = (updates as any).paidAmount ?? invoice.paidAmount ?? 0;
                    return Math.max(0, total - paid);
                  })(),
                  updatedAt: new Date().toISOString() 
                }
              : invoice
          ),
          activities: [...state.activities, {
            id: generateId(),
            type: 'invoice',
            action: 'Updated invoice',
            name: updates.memberName || state.invoices.find(i => i.id === id)?.memberName || 'Unknown',
            time: new Date().toISOString(),
            details: `Updated invoice information`,
            memberId: updates.memberId || state.invoices.find(i => i.id === id)?.memberId,
          }],
        }));
      },
      
      deleteInvoice: (id) => {
        const invoice = get().invoices.find(i => i.id === id);
        set((state) => ({
          invoices: state.invoices.filter((invoice) => invoice.id !== id),
          activities: [...state.activities, {
            id: generateId(),
            type: 'invoice',
            action: 'Deleted invoice',
            name: invoice?.memberName || 'Unknown',
            time: new Date().toISOString(),
            details: `Deleted invoice for ${invoice?.memberName}`,
            memberId: invoice?.memberId,
          }],
        }));
      },
      
      getInvoiceById: (id) => {
        return get().invoices.find((invoice) => invoice.id === id);
      },

      generateInvoiceNumber: () => {
        const sequence = get().lastInvoiceSequence + 1;
        set((state) => ({ lastInvoiceSequence: sequence }));
        // Format: MP0001, MP0002, ...
        return `MP${sequence.toString().padStart(4, '0')}`;
      },

      // Follow-ups
      addFollowUp: (followUp) => {
        const newFollowUp: FollowUp = {
          ...followUp,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          followUps: [...state.followUps, newFollowUp],
          activities: [...state.activities, {
            id: generateId(),
            type: 'followup',
            action: 'Added follow-up',
            name: newFollowUp.name,
            time: new Date().toISOString(),
            details: `Added follow-up for ${newFollowUp.name}`,
          }],
        }));
      },
      
      updateFollowUp: (id, updates) => {
        set((state) => ({
          followUps: state.followUps.map((followUp) =>
            followUp.id === id
              ? { ...followUp, ...updates, updatedAt: new Date().toISOString() }
              : followUp
          ),
          activities: [...state.activities, {
            id: generateId(),
            type: 'followup',
            action: 'Updated follow-up',
            name: updates.name || state.followUps.find(f => f.id === id)?.name || 'Unknown',
            time: new Date().toISOString(),
            details: `Updated follow-up information`,
          }],
        }));
      },
      
      deleteFollowUp: (id) => {
        const followUp = get().followUps.find(f => f.id === id);
        set((state) => ({
          followUps: state.followUps.filter((followUp) => followUp.id !== id),
          activities: [...state.activities, {
            id: generateId(),
            type: 'followup',
            action: 'Deleted follow-up',
            name: followUp?.name || 'Unknown',
            time: new Date().toISOString(),
            details: `Deleted follow-up for ${followUp?.name}`,
          }],
        }));
      },
      
      getFollowUpById: (id) => {
        return get().followUps.find((followUp) => followUp.id === id);
      },

      // Activities
      addActivity: (activity) => {
        const newActivity: Activity = {
          ...activity,
          id: generateId(),
        };
        set((state) => ({
          activities: [...state.activities, newActivity],
        }));
      },

      getActivitiesByType: (type) => {
        return get().activities.filter((activity) => activity.type === type);
      },

      // Check-ins
      addCheckIn: (checkIn) => {
        const newCheckIn: CheckIn = {
          ...checkIn,
          id: generateId(),
        };
        set((state) => ({
          checkIns: [...state.checkIns, newCheckIn],
          activities: [...state.activities, {
            id: generateId(),
            type: 'checkin',
            action: 'Member checked in',
            name: newCheckIn.memberName,
            time: new Date().toISOString(),
            details: `${newCheckIn.memberName} checked in at ${newCheckIn.checkInTime}`,
            memberId: newCheckIn.memberId,
          }],
        }));
      },
      
      getCheckInsByMember: (memberId) => {
        return get().checkIns.filter((checkIn) => checkIn.memberId === memberId);
      },

      getCheckInsByDate: (date) => {
        return get().checkIns.filter((checkIn) => checkIn.date === date);
      },

      // Visitors
      addVisitor: (visitor) => {
        const newVisitor = {
          ...visitor,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          visitors: [...state.visitors, newVisitor],
          activities: [...state.activities, {
            id: generateId(),
            type: 'member',
            action: 'Visitor registered',
            name: newVisitor.name || 'Unknown',
            time: new Date().toISOString(),
            details: `New visitor registered: ${newVisitor.name}`,
          }],
        }));
      },
      
      updateVisitor: (id, updates) => {
        set((state) => ({
          visitors: state.visitors.map((visitor) =>
            visitor.id === id
              ? { ...visitor, ...updates, updatedAt: new Date().toISOString() }
              : visitor
          ),
          activities: [...state.activities, {
            id: generateId(),
            type: 'member',
            action: 'Visitor updated',
            name: updates.name || state.visitors.find(v => v.id === id)?.name || 'Unknown',
            time: new Date().toISOString(),
            details: `Visitor information updated`,
          }],
        }));
      },
      
      // Proteins
      addProtein: (protein) => {
        const newProtein: Protein = {
          ...protein,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          margin: protein.sellingPrice - protein.basePrice,
          profit: (protein.sellingPrice - protein.basePrice) * protein.unitsSold,
        };
        set((state) => ({
          proteins: [...state.proteins, newProtein],
        }));
      },

      updateProtein: (id, updates) => {
        set((state) => ({
          proteins: state.proteins.map((protein) =>
            protein.id === id
              ? { 
                  ...protein, 
                  ...updates, 
                  updatedAt: new Date().toISOString(),
                  margin: updates.sellingPrice ? updates.sellingPrice - protein.basePrice : protein.margin,
                  profit: updates.sellingPrice ? (updates.sellingPrice - protein.basePrice) * protein.unitsSold : protein.profit,
                }
              : protein
          ),
        }));
      },

      deleteProtein: (id) => {
        set((state) => ({
          proteins: state.proteins.filter((protein) => protein.id !== id),
        }));
      },

      getProteinById: (id) => {
        return get().proteins.find((protein) => protein.id === id);
      },
      
      recordProteinSale: (proteinId, unitsSold) => {
        const protein = get().proteins.find(p => p.id === proteinId);
        if (!protein) {
          throw new Error('Protein not found');
        }

        if (protein.quantityInStock < unitsSold) {
          throw new Error('Insufficient stock');
        }

        set((state) => ({
          proteins: state.proteins.map((p) =>
            p.id === proteinId
              ? {
                  ...p,
                  quantityInStock: p.quantityInStock - unitsSold,
                  unitsSold: p.unitsSold + unitsSold,
                updatedAt: new Date().toISOString(),
                  profit: (p.sellingPrice - p.basePrice) * (p.unitsSold + unitsSold),
            }
              : p
          ),
          activities: [...state.activities, {
            id: generateId(),
            type: 'member',
            action: 'Protein sale recorded',
            name: protein.name,
            time: new Date().toISOString(),
            details: `Sold ${unitsSold} units of ${protein.name} for ₹${protein.sellingPrice * unitsSold}`,
          }],
        }));
      },

      // Settings
      updatePricing: (pricing) => {
        set((state) => ({
          pricing: { ...state.pricing, ...pricing },
        }));
      },
      
      updateTermsAndConditions: (terms) => {
        set({ termsAndConditions: terms });
      },

      setPricing: (pricing) => {
        set((state) => ({
          pricing: { ...state.pricing, ...pricing },
        }));
      },

      setTermsAndConditions: (terms) => {
        set({ termsAndConditions: terms });
      },

      // Data management
      exportData: () => {
        const state = get();
        return JSON.stringify({
          members: state.members,
          invoices: state.invoices,
          followUps: state.followUps,
          activities: state.activities,
          checkIns: state.checkIns,
          proteins: state.proteins,
          pricing: state.pricing,
          termsAndConditions: state.termsAndConditions,
          lastInvoiceSequence: state.lastInvoiceSequence,
        }, null, 2);
      },
      
      importData: (data) => {
        try {
          const parsedData = JSON.parse(data);
           set({
            members: parsedData.members || [],
            trainers: parsedData.trainers || [],
            visitors: parsedData.visitors || [],
            invoices: parsedData.invoices || [],
            followUps: parsedData.followUps || [],
            activities: parsedData.activities || [],
            checkIns: parsedData.checkIns || [],
            proteins: parsedData.proteins || [],
            pricing: parsedData.pricing || {
              monthlyFee: 1999,
              quarterlyFee: 5500,
              halfYearlyFee: 6999,
              yearlyFee: 8500,
              personalTrainingFee: 5500,
            },
            termsAndConditions: parsedData.termsAndConditions || '',
            lastInvoiceSequence: parsedData.lastInvoiceSequence || 0,
          });
         } catch (error) {
          console.error('Failed to import data:', error);
        }
      },

      clearAllData: () => {
        set({
          members: [],
          trainers: [],
          visitors: [],
          invoices: [],
          followUps: [],
          activities: [],
          checkIns: [],
          proteins: [],
          lastInvoiceSequence: 0,
        });
      },

      // Refresh data from backend
      refreshData: async () => {
        try {
          const [membersData, trainersData, visitorsData, invoicesData, followUpsData, activitiesData, proteinsData] = await Promise.all([
            loadSyncedJSON('members'),
            loadSyncedJSON('trainers'),
            loadSyncedJSON('visitors'),
            loadSyncedJSON('invoices'),
            loadSyncedJSON('followups'),
            loadSyncedJSON('activities'),
            loadSyncedJSON('proteins')
          ]);

          // Merge strategy: keep local items if server returns empty, and merge by id otherwise
          set((state) => {
            const mergeById = <T extends { id: string }>(localArr: T[], serverArr: T[]): T[] => {
              if (!serverArr || serverArr.length === 0) return localArr;
              const map = new Map<string, T>();
              for (const item of localArr) map.set(item.id, item);
              for (const s of serverArr) map.set(s.id, { ...(map.get(s.id) || {} as T), ...s });
              return Array.from(map.values());
            };

            return {
              members: mergeById(state.members, membersData as any),
              trainers: trainersData && trainersData.length > 0 ? trainersData : state.trainers,
              visitors: visitorsData && visitorsData.length > 0 ? visitorsData : state.visitors,
              invoices: mergeById(state.invoices as any, invoicesData as any) as any,
              followUps: mergeById(state.followUps as any, followUpsData as any) as any,
              activities: mergeById(state.activities as any, activitiesData as any) as any,
              proteins: mergeById(state.proteins as any, proteinsData as any) as any,
            };
          });

          console.log(`Refreshed data with merge`);
        } catch (error) {
          console.error('Failed to refresh data:', error);
        }
      },

      // Auto-expire members
      autoExpireMembers: async () => {
        const now = new Date();
        set((state) => ({
          members: state.members.map((member) => {
            const endDate = new Date(member.endDate);
            if (endDate < now && member.status === 'active') {
              return { ...member, status: 'expired' as const };
            }
            return member;
          }),
        }));
      },
    }),
    {
      name: 'tristar-fitness-storage',
      partialize: (state) => ({
        members: state.members,
        invoices: state.invoices,
        followUps: state.followUps,
        activities: state.activities,
        checkIns: state.checkIns,
        proteins: state.proteins,
        pricing: state.pricing,
        termsAndConditions: state.termsAndConditions,
        lastInvoiceSequence: state.lastInvoiceSequence,
      }),
      storage: createJSONStorage(() => localStorage),
      skipHydration: false, // Allow hydration to happen
      onRehydrateStorage: () => (state) => {
        // Called after hydration is complete
        console.log('Rehydration complete', state);
        if (state) {
          console.log('DataStore initialized with:', {
            members: state.members?.length || 0,
            invoices: state.invoices?.length || 0,
            followUps: state.followUps?.length || 0,
            activities: state.activities?.length || 0,
            proteins: state.proteins?.length || 0
          });
        }
      }
    }
  )
);