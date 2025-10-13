import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, ArrowLeft, Save, Calendar } from 'lucide-react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { formatINR } from '@/lib/utils'
import { useDataStore } from '@/lib/dataSync'

interface Member {
  id: string
  name: string
  email: string
  phone: string
  membershipType: 'monthly' | 'quarterly' | 'annual'
  startDate: string
  expiryDate: string
  status: 'active' | 'expired' | 'pending'
  lastVisit?: string
  totalVisits: number
}

const EditMember = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { members, pricing, updateMember, getMemberById } = useDataStore()
  const [member, setMember] = useState<Member | null>(null)
  const [isRenewal, setIsRenewal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    membershipType: 'monthly' as const,
    startDate: '',
    expiryDate: '',
    status: 'active' as const
  })

  // Check if this is a renewal operation
  useEffect(() => {
    const renewParam = searchParams.get('renew')
    if (renewParam === 'true') {
      setIsRenewal(true)
      
      // Pre-fill data from URL parameters for renewal
      const name = searchParams.get('name') || ''
      const email = searchParams.get('email') || ''
      const phone = searchParams.get('phone') || ''
      const membershipType = (searchParams.get('membershipType') as 'monthly' | 'quarterly' | 'annual') || 'monthly'
      
      // Set today as start date for renewal
      const today = new Date().toISOString().split('T')[0]
      const newExpiryDate = calculateExpiryDate(today, membershipType)
      
      setFormData({
        name,
        email,
        phone,
        membershipType,
        startDate: today,
        expiryDate: newExpiryDate,
        status: 'active'
      })
      
      // Create member object for display
      const renewalMember: Member = {
        id: id || '1',
        name,
        email,
        phone,
        membershipType,
        startDate: today,
        expiryDate: newExpiryDate,
        status: 'active',
        lastVisit: new Date().toISOString(),
        totalVisits: 0
      }
      setMember(renewalMember)
    } else {
      // Regular edit mode - load existing member data from data store
      const existingMember = getMemberById(id || '')
      if (existingMember) {
        const memberData: Member = {
          id: existingMember.id,
          name: existingMember.name,
          email: existingMember.email,
          phone: existingMember.phone,
          membershipType: existingMember.membershipType as 'monthly' | 'quarterly' | 'annual',
          startDate: existingMember.startDate,
          expiryDate: existingMember.endDate || existingMember.expiryDate || '',
          status: existingMember.status as 'active' | 'expired' | 'pending',
          lastVisit: existingMember.lastVisit,
          totalVisits: existingMember.totalVisits || 0
        }
        setMember(memberData)
        setFormData({
          name: memberData.name,
          email: memberData.email,
          phone: memberData.phone,
          membershipType: memberData.membershipType,
          startDate: memberData.startDate,
          expiryDate: memberData.expiryDate,
          status: memberData.status
        })
      } else {
        toast({
          title: "Error",
          description: "Member not found",
          variant: "destructive"
        })
        navigate('/members')
      }
    }
  }, [id, searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const calculateExpiryDate = (startDate: string, type: string) => {
    const start = new Date(startDate)
    let expiry = new Date(start)
    
    switch (type) {
      case 'monthly':
        expiry.setMonth(expiry.getMonth() + 1)
        break
      case 'quarterly':
        expiry.setMonth(expiry.getMonth() + 3)
        break
      case 'annual':
        expiry.setFullYear(expiry.getFullYear() + 1)
        break
    }
    
    return expiry.toISOString().split('T')[0]
  }

  const handleMembershipTypeChange = (type: string) => {
    const newType = type as 'monthly' | 'quarterly' | 'annual'
    setFormData(prev => {
      const newExpiryDate = calculateExpiryDate(prev.startDate, newType)
      return { ...prev, membershipType: newType, expiryDate: newExpiryDate }
    })
  }

  const handleStartDateChange = (date: string) => {
    setFormData(prev => {
      const newExpiryDate = calculateExpiryDate(date, prev.membershipType)
      return { ...prev, startDate: date, expiryDate: newExpiryDate }
    })
  }

  const getMembershipPrice = (type: string) => {
    switch (type) {
      case 'monthly': return pricing.monthlyFee
      case 'quarterly': return pricing.quarterlyFee
      case 'annual': return pricing.yearlyFee
      default: return pricing.monthlyFee
    }
  }

  const saveChanges = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    if (!member) return

    // Update the member in the data store
    updateMember(member.id, {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      membershipType: formData.membershipType,
      startDate: formData.startDate,
      endDate: formData.expiryDate,
      status: formData.status
    })

    if (isRenewal) {
      toast({
        title: "Success",
        description: `Membership renewed successfully for ${formData.name}`,
      })
    } else {
      toast({
        title: "Success",
        description: `Member ${formData.name} updated successfully`,
      })
    }
    
    navigate('/members')
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading member details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/members">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isRenewal ? 'Renew Membership' : 'Edit Member'}
            </h1>
            <p className="text-gray-600">
              {isRenewal 
                ? 'Renew membership with updated details' 
                : 'Update member information'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Renewal Banner */}
      {isRenewal && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800">Membership Renewal</h3>
                <p className="text-sm text-green-700">
                  Renewing membership for {member.name}. All personal details are pre-filled. 
                  You can modify the membership type and dates as needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Edit Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>{isRenewal ? 'Renew Membership Details' : 'Edit Member Details'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter member's full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="member@email.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="membershipType">Membership Type *</Label>
                  <Select value={formData.membershipType} onValueChange={handleMembershipTypeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly - {formatINR(pricing.monthlyFee)}</SelectItem>
                      <SelectItem value="quarterly">Quarterly - {formatINR(pricing.quarterlyFee)}</SelectItem>
                      <SelectItem value="annual">Annual - {formatINR(pricing.yearlyFee)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    disabled={!isRenewal}
                  />
                  {!isRenewal && (
                    <p className="text-xs text-gray-500 mt-1">
                      Start date cannot be changed for existing memberships
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    name="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    disabled
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button onClick={saveChanges} className="bg-green-600 hover:bg-green-700">
                  <Save className="h-4 w-4 mr-2" />
                  {isRenewal ? 'Renew Membership' : 'Save Changes'}
                </Button>
                <Link to="/members">
                  <Button variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Member Info Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isRenewal ? 'New Membership' : 'Current Membership'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Type:</span>
                <span className="font-medium">{member.membershipType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Price:</span>
                <span className="font-medium">{formatINR(getMembershipPrice(member.membershipType))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  member.status === 'active' ? 'bg-green-100 text-green-800' :
                  member.status === 'expired' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {member.status.toUpperCase()}
                </span>
              </div>
              {isRenewal && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Start Date:</span>
                  <span className="font-medium">{new Date(formData.startDate).toLocaleDateString()}</span>
                </div>
              )}
              {isRenewal && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Expiry Date:</span>
                  <span className="font-medium">{new Date(formData.expiryDate).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Visits:</span>
                <span className="font-medium">{member.totalVisits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Last Visit:</span>
                <span className="font-medium">
                  {member.lastVisit ? new Date(member.lastVisit).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!isRenewal && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="sm"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0]
                    const newExpiryDate = calculateExpiryDate(today, formData.membershipType)
                    navigate(`/edit-member/${member?.id}?renew=true&name=${encodeURIComponent(formData.name)}&email=${encodeURIComponent(formData.email)}&phone=${encodeURIComponent(formData.phone)}&membershipType=${formData.membershipType}`)
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Renew Membership
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full" 
                size="sm"
                onClick={() => {
                  toast({
                    title: "Reminder Sent",
                    description: `Payment reminder sent to ${member?.name} at ${member?.email}`,
                  })
                }}
              >
                Send Reminder
              </Button>
              {isRenewal && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="sm"
                  onClick={() => navigate('/members')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Members
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default EditMember
