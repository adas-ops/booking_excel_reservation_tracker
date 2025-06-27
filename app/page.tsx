"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { read, utils, write } from "xlsx"
import { format, addDays, parseISO, isAfter, isBefore, isEqual, differenceInDays } from "date-fns"
import {
  Upload,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Plus,
  Download,
  Trash2,
  Edit,
  Save,
  X,
  Search,
  Filter,
  SlidersHorizontal,
  Moon,
  Sun,
  Printer,
  FileText,
  BarChart4,
  Users,
  DollarSign,
  Home,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ThemeProvider } from "@/components/theme-provider"
import { useTheme } from "next-themes"

// Define booking status types
type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed"

interface BookingData {
  id: string
  checkInDate: string
  checkOutDate: string
  clientAndRoom: string
  totalAmount: number
  advancePayment: number
  paidAmount: number
  remainingBalance: number
  isPaid: boolean
  dueInOneWeek: boolean
  status: BookingStatus
  guestCount: number
  roomType: string
  notes: string
  createdAt: string
  updatedAt: string
}

interface DashboardStats {
  totalBookings: number
  upcomingBookings: number
  totalRevenue: number
  paidRevenue: number
  pendingRevenue: number
  occupancyRate: number
  averageStay: number
}

export default function BookingTracker() {
  // State for booking data
  const [bookingData, setBookingData] = useState<BookingData[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<BookingData[]>([])

  // State for Excel import
  const [fileError, setFileError] = useState<string | null>(null)
  const [excelData, setExcelData] = useState<any[]>([])
  const [showManualAssignment, setShowManualAssignment] = useState(false)
  const [checkInColumn, setCheckInColumn] = useState<string>("")
  const [checkOutColumn, setCheckOutColumn] = useState<string>("")
  const [clientRoomColumn, setClientRoomColumn] = useState<string>("")
  const [totalAmountColumn, setTotalAmountColumn] = useState<string>("")
  const [advancePaymentColumn, setAdvancePaymentColumn] = useState<string>("")
  const [paidAmountColumn, setPaidAmountColumn] = useState<string>("")
  const [availableColumns, setAvailableColumns] = useState<string[]>([])

  // State for form inputs
  const [newCheckInDate, setNewCheckInDate] = useState<string>("")
  const [newCheckOutDate, setNewCheckOutDate] = useState<string>("")
  const [newClientRoom, setNewClientRoom] = useState<string>("")
  const [newTotalAmount, setNewTotalAmount] = useState<string>("")
  const [newAdvancePayment, setNewAdvancePayment] = useState<string>("")
  const [newPaidAmount, setNewPaidAmount] = useState<string>("")
  const [newGuestCount, setNewGuestCount] = useState<string>("1")
  const [newRoomType, setNewRoomType] = useState<string>("")
  const [newStatus, setNewStatus] = useState<BookingStatus>("confirmed")
  const [newNotes, setNewNotes] = useState<string>("")

  // State for editing and deleting
  const [editingBooking, setEditingBooking] = useState<BookingData | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null)

  // State for filtering and pagination
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all")
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<string>("checkInDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // State for UI
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showBookingDetails, setShowBookingDetails] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [activeView, setActiveView] = useState<"bookings" | "dashboard">("bookings")

  const { toast } = useToast()
  const { setTheme } = useTheme()

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem("bookingData")
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData)
        setBookingData(parsedData)
      } catch (error) {
        console.error("Error loading saved data:", error)
      }
    }
  }, [])

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (bookingData.length > 0) {
      localStorage.setItem("bookingData", JSON.stringify(bookingData))
    }
  }, [bookingData])

  // Find bookings with check-in date in one week
  useEffect(() => {
    if (bookingData.length > 0) {
      const today = new Date()
      const oneWeekFromNow = addDays(today, 7)
      const oneWeekFromNowStr = format(oneWeekFromNow, "yyyy-MM-dd")

      const upcoming = bookingData.filter((booking) => {
        return booking.checkInDate === oneWeekFromNowStr && booking.status !== "cancelled"
      })

      setUpcomingBookings(upcoming)

      if (upcoming.length > 0) {
        toast({
          title: "Upcoming Check-ins Found",
          description: `${upcoming.length} bookings have check-in exactly one week from today`,
          duration: 5000,
        })
      }
    }
  }, [bookingData, toast])

  // Calculate dashboard statistics
  const dashboardStats = useMemo<DashboardStats>(() => {
    const today = new Date()
    const todayStr = format(today, "yyyy-MM-dd")

    const upcoming = bookingData.filter(
      (booking) => booking.checkInDate >= todayStr && booking.status !== "cancelled" && booking.status !== "completed",
    )

    const totalRevenue = bookingData.reduce((sum, booking) => sum + booking.totalAmount, 0)
    const paidRevenue = bookingData.reduce((sum, booking) => sum + booking.advancePayment + booking.paidAmount, 0)

    // Calculate average stay duration
    let totalStayDays = 0
    let bookingsWithDuration = 0

    bookingData.forEach((booking) => {
      if (booking.checkInDate && booking.checkOutDate) {
        const checkIn = parseISO(booking.checkInDate)
        const checkOut = parseISO(booking.checkOutDate)
        const duration = differenceInDays(checkOut, checkIn)

        if (duration > 0) {
          totalStayDays += duration
          bookingsWithDuration++
        }
      }
    })

    const averageStay = bookingsWithDuration > 0 ? totalStayDays / bookingsWithDuration : 0

    // Calculate occupancy rate (simplified)
    const totalRooms = new Set(bookingData.map((booking) => booking.roomType)).size || 1
    const occupiedRooms = new Set(
      bookingData
        .filter(
          (booking) =>
            booking.status !== "cancelled" &&
            booking.checkInDate <= todayStr &&
            (booking.checkOutDate >= todayStr || !booking.checkOutDate),
        )
        .map((booking) => booking.roomType),
    ).size

    const occupancyRate = (occupiedRooms / totalRooms) * 100

    return {
      totalBookings: bookingData.length,
      upcomingBookings: upcoming.length,
      totalRevenue,
      paidRevenue,
      pendingRevenue: totalRevenue - paidRevenue,
      occupancyRate,
      averageStay,
    }
  }, [bookingData])

  // Get unique room types for filtering
  const uniqueRoomTypes = useMemo(() => {
    const types = new Set<string>()
    bookingData.forEach((booking) => {
      if (booking.roomType) {
        types.add(booking.roomType)
      }
    })
    return Array.from(types)
  }, [bookingData])

  // Determine if booking is fully paid
  const isFullyPaid = (totalAmount: number, paidAmount: number, advancePayment: number): boolean => {
    return paidAmount + advancePayment >= totalAmount
  }

  // Handle file upload for Excel import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileError(null)
    setIsLoading(true)

    try {
      const data = await file.arrayBuffer()
      const workbook = read(data, { type: "array" })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        setFileError("The Excel file is empty or has no valid data")
        setIsLoading(false)
        return
      }

      // Store the raw data for manual column assignment
      setExcelData(jsonData)

      // Get available columns from the first row
      const firstRow = jsonData[0] as any
      const columns = Object.keys(firstRow)
      setAvailableColumns(columns)

      // Try to auto-detect columns
      const checkInCols = columns.filter(
        (col) =>
          col.toLowerCase().includes("check in") ||
          col.toLowerCase().includes("checkin") ||
          col.toLowerCase().includes("arrival") ||
          col.toLowerCase().includes("date"),
      )

      const checkOutCols = columns.filter(
        (col) =>
          col.toLowerCase().includes("check out") ||
          col.toLowerCase().includes("checkout") ||
          col.toLowerCase().includes("departure"),
      )

      const clientRoomCols = columns.filter(
        (col) =>
          col.toLowerCase().includes("client") ||
          col.toLowerCase().includes("guest") ||
          col.toLowerCase().includes("room") ||
          col.toLowerCase().includes("name"),
      )

      const totalAmountCols = columns.filter(
        (col) =>
          col.toLowerCase().includes("total") ||
          col.toLowerCase().includes("owe") ||
          col.toLowerCase().includes("price") ||
          col.toLowerCase().includes("amount"),
      )

      const advancePaymentCols = columns.filter(
        (col) =>
          col.toLowerCase().includes("advance") ||
          col.toLowerCase().includes("deposit") ||
          col.toLowerCase().includes("prepaid"),
      )

      const paidAmountCols = columns.filter(
        (col) =>
          col.toLowerCase().includes("paid") ||
          col.toLowerCase().includes("payment") ||
          col.toLowerCase().includes("received"),
      )

      if (checkInCols.length > 0) setCheckInColumn(checkInCols[0])
      if (checkOutCols.length > 0) setCheckOutColumn(checkOutCols[0])
      if (clientRoomCols.length > 0) setClientRoomColumn(clientRoomCols[0])
      if (totalAmountCols.length > 0) setTotalAmountColumn(totalAmountCols[0])
      if (advancePaymentCols.length > 0) setAdvancePaymentColumn(advancePaymentCols[0])
      if (paidAmountCols.length > 0) setPaidAmountColumn(paidAmountCols[0])

      // Show manual assignment dialog
      setShowManualAssignment(true)
      setIsLoading(false)

      toast({
        title: "Excel File Loaded",
        description: "Please confirm column assignments",
      })
    } catch (error) {
      console.error("Error processing Excel file:", error)
      setFileError(`Error processing Excel file: ${error instanceof Error ? error.message : "Unknown error"}`)
      setIsLoading(false)
    }
  }

  // Process Excel data after column assignment
  const processExcelData = () => {
    if (!checkInColumn || !clientRoomColumn) {
      toast({
        title: "Missing Required Fields",
        description: "Please select at least check-in date and client/room columns",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const processedData = excelData
        .map((row: any, index: number) => {
          // Get check-in and check-out dates
          let checkInDate = row[checkInColumn]?.toString() || ""
          let checkOutDate = checkOutColumn ? row[checkOutColumn]?.toString() || "" : ""

          // Try to standardize date formats
          try {
            if (checkInDate && typeof checkInDate === "string") {
              // Handle Excel date number format
              if (!isNaN(Number(checkInDate))) {
                const excelDate = new Date(Math.round((Number(checkInDate) - 25569) * 86400 * 1000))
                checkInDate = format(excelDate, "yyyy-MM-dd")
              }
              // Try to parse various date formats
              else {
                const parsedDate = new Date(checkInDate)
                if (!isNaN(parsedDate.getTime())) {
                  checkInDate = format(parsedDate, "yyyy-MM-dd")
                }
              }
            }

            if (checkOutDate && typeof checkOutDate === "string") {
              // Handle Excel date number format
              if (!isNaN(Number(checkOutDate))) {
                const excelDate = new Date(Math.round((Number(checkOutDate) - 25569) * 86400 * 1000))
                checkOutDate = format(excelDate, "yyyy-MM-dd")
              }
              // Try to parse various date formats
              else {
                const parsedDate = new Date(checkOutDate)
                if (!isNaN(parsedDate.getTime())) {
                  checkOutDate = format(parsedDate, "yyyy-MM-dd")
                }
              }
            }
          } catch (e) {
            console.error("Error parsing date:", e)
          }

          // Skip invalid entries
          if (!checkInDate) {
            return null
          }

          // Get client/room, total amount, advance payment, and paid amount
          const clientAndRoom = row[clientRoomColumn]?.toString() || `Booking ${index + 1}`

          let totalAmount = 0
          if (totalAmountColumn && row[totalAmountColumn] !== undefined) {
            const parsedAmount = Number.parseFloat(row[totalAmountColumn].toString())
            if (!isNaN(parsedAmount)) {
              totalAmount = parsedAmount
            }
          }

          let advancePayment = 0
          if (advancePaymentColumn && row[advancePaymentColumn] !== undefined) {
            const parsedAmount = Number.parseFloat(row[advancePaymentColumn].toString())
            if (!isNaN(parsedAmount)) {
              advancePayment = parsedAmount
            }
          }

          let paidAmount = 0
          if (paidAmountColumn && row[paidAmountColumn] !== undefined) {
            const parsedAmount = Number.parseFloat(row[paidAmountColumn].toString())
            if (!isNaN(parsedAmount)) {
              paidAmount = parsedAmount
            }
          }

          const remainingBalance = totalAmount - (advancePayment + paidAmount)
          const isPaid = remainingBalance <= 0

          // Extract room type from client and room if possible
          let roomType = ""
          if (clientAndRoom.includes("-")) {
            const parts = clientAndRoom.split("-")
            if (parts.length >= 2) {
              roomType = parts[parts.length - 1].trim()
            }
          } else if (clientAndRoom.includes("Room")) {
            const roomMatch = clientAndRoom.match(/Room\s+(\w+)/i)
            if (roomMatch && roomMatch[1]) {
              roomType = roomMatch[1]
            }
          }

          // Determine status based on dates and payment
          let status: BookingStatus = "confirmed"
          const today = new Date()
          const todayStr = format(today, "yyyy-MM-dd")

          if (checkOutDate && checkOutDate < todayStr) {
            status = "completed"
          } else if (checkInDate > todayStr) {
            status = "pending"
          }

          if (isPaid && checkInDate <= todayStr) {
            status = "confirmed"
          }

          return {
            id: `${index}-${Date.now()}`,
            checkInDate,
            checkOutDate,
            clientAndRoom,
            totalAmount,
            advancePayment,
            paidAmount,
            remainingBalance,
            isPaid,
            dueInOneWeek: false,
            status,
            guestCount: 1, // Default guest count
            roomType,
            notes: "",
            createdAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
          }
        })
        .filter(Boolean) // Remove null entries

      setBookingData((prev) => [...prev, ...(processedData as BookingData[])])
      setShowManualAssignment(false)
      setIsLoading(false)

      toast({
        title: "Excel File Processed",
        description: `Successfully processed ${processedData.length} booking records`,
      })
    } catch (error) {
      console.error("Error processing data:", error)
      setFileError(`Error processing data: ${error instanceof Error ? error.message : "Unknown error"}`)
      setIsLoading(false)
    }
  }

  // Add a new booking
  const addNewBooking = () => {
    if (!newCheckInDate) {
      toast({
        title: "Missing Check-in Date",
        description: "Please enter a check-in date",
        variant: "destructive",
      })
      return
    }

    if (!newClientRoom) {
      toast({
        title: "Missing Client/Room Information",
        description: "Please enter client and room information",
        variant: "destructive",
      })
      return
    }

    let totalAmount = 0
    if (newTotalAmount) {
      const parsedAmount = Number.parseFloat(newTotalAmount)
      if (!isNaN(parsedAmount)) {
        totalAmount = parsedAmount
      }
    }

    let advancePayment = 0
    if (newAdvancePayment) {
      const parsedAmount = Number.parseFloat(newAdvancePayment)
      if (!isNaN(parsedAmount)) {
        advancePayment = parsedAmount
      }
    }

    let paidAmount = 0
    if (newPaidAmount) {
      const parsedAmount = Number.parseFloat(newPaidAmount)
      if (!isNaN(parsedAmount)) {
        paidAmount = parsedAmount
      }
    }

    let guestCount = 1
    if (newGuestCount) {
      const parsedCount = Number.parseInt(newGuestCount)
      if (!isNaN(parsedCount) && parsedCount > 0) {
        guestCount = parsedCount
      }
    }

    const remainingBalance = totalAmount - (advancePayment + paidAmount)
    const isPaid = remainingBalance <= 0

    const newBooking: BookingData = {
      id: `manual-${Date.now()}`,
      checkInDate: newCheckInDate,
      checkOutDate: newCheckOutDate,
      clientAndRoom: newClientRoom,
      totalAmount,
      advancePayment,
      paidAmount,
      remainingBalance,
      isPaid,
      dueInOneWeek: false,
      status: newStatus,
      guestCount,
      roomType: newRoomType,
      notes: newNotes,
      createdAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    }

    setBookingData((prev) => [...prev, newBooking])

    // Reset form
    setNewCheckInDate("")
    setNewCheckOutDate("")
    setNewClientRoom("")
    setNewTotalAmount("")
    setNewAdvancePayment("")
    setNewPaidAmount("")
    setNewGuestCount("1")
    setNewRoomType("")
    setNewStatus("confirmed")
    setNewNotes("")

    toast({
      title: "Booking Added",
      description: `Added booking for ${newClientRoom} on ${newCheckInDate}`,
    })
  }

  // Update an existing booking
  const updateBooking = () => {
    if (!editingBooking) return

    if (!newCheckInDate) {
      toast({
        title: "Missing Check-in Date",
        description: "Please enter a check-in date",
        variant: "destructive",
      })
      return
    }

    if (!newClientRoom) {
      toast({
        title: "Missing Client/Room Information",
        description: "Please enter client and room information",
        variant: "destructive",
      })
      return
    }

    let totalAmount = 0
    if (newTotalAmount) {
      const parsedAmount = Number.parseFloat(newTotalAmount)
      if (!isNaN(parsedAmount)) {
        totalAmount = parsedAmount
      }
    }

    let advancePayment = 0
    if (newAdvancePayment) {
      const parsedAmount = Number.parseFloat(newAdvancePayment)
      if (!isNaN(parsedAmount)) {
        advancePayment = parsedAmount
      }
    }

    let paidAmount = 0
    if (newPaidAmount) {
      const parsedAmount = Number.parseFloat(newPaidAmount)
      if (!isNaN(parsedAmount)) {
        paidAmount = parsedAmount
      }
    }

    let guestCount = 1
    if (newGuestCount) {
      const parsedCount = Number.parseInt(newGuestCount)
      if (!isNaN(parsedCount) && parsedCount > 0) {
        guestCount = parsedCount
      }
    }

    const remainingBalance = totalAmount - (advancePayment + paidAmount)
    const isPaid = remainingBalance <= 0

    setBookingData((prev) =>
      prev.map((booking) =>
        booking.id === editingBooking.id
          ? {
              ...booking,
              checkInDate: newCheckInDate,
              checkOutDate: newCheckOutDate,
              clientAndRoom: newClientRoom,
              totalAmount,
              advancePayment,
              paidAmount,
              remainingBalance,
              isPaid,
              status: newStatus,
              guestCount,
              roomType: newRoomType,
              notes: newNotes,
              updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            }
          : booking,
      ),
    )

    toast({
      title: "Booking Updated",
      description: `Updated booking for ${newClientRoom} on ${newCheckInDate}`,
    })

    // Reset form and editing state
    setEditingBooking(null)
    setNewCheckInDate("")
    setNewCheckOutDate("")
    setNewClientRoom("")
    setNewTotalAmount("")
    setNewAdvancePayment("")
    setNewPaidAmount("")
    setNewGuestCount("1")
    setNewRoomType("")
    setNewStatus("confirmed")
    setNewNotes("")
  }

  // Start editing a booking
  const startEditBooking = (booking: BookingData) => {
    setEditingBooking(booking)
    setNewCheckInDate(booking.checkInDate)
    setNewCheckOutDate(booking.checkOutDate)
    setNewClientRoom(booking.clientAndRoom)
    setNewTotalAmount(booking.totalAmount.toString())
    setNewAdvancePayment(booking.advancePayment.toString())
    setNewPaidAmount(booking.paidAmount.toString())
    setNewGuestCount(booking.guestCount.toString())
    setNewRoomType(booking.roomType)
    setNewStatus(booking.status)
    setNewNotes(booking.notes)
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingBooking(null)
    setNewCheckInDate("")
    setNewCheckOutDate("")
    setNewClientRoom("")
    setNewTotalAmount("")
    setNewAdvancePayment("")
    setNewPaidAmount("")
    setNewGuestCount("1")
    setNewRoomType("")
    setNewStatus("confirmed")
    setNewNotes("")
  }

  // Confirm deletion of a booking
  const confirmDeleteBooking = (id: string) => {
    setBookingToDelete(id)
    setShowDeleteConfirm(true)
  }

  // Delete a booking
  const deleteBooking = () => {
    if (!bookingToDelete) return

    setBookingData((prev) => prev.filter((booking) => booking.id !== bookingToDelete))
    setShowDeleteConfirm(false)
    setBookingToDelete(null)

    toast({
      title: "Booking Deleted",
      description: "The booking has been removed from your tracker",
    })
  }

  // Mark a booking as paid
  const markAsPaid = (id: string) => {
    setBookingData((prev) =>
      prev.map((booking) =>
        booking.id === id
          ? {
              ...booking,
              paidAmount: booking.totalAmount - booking.advancePayment,
              remainingBalance: 0,
              isPaid: true,
              updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            }
          : booking,
      ),
    )

    toast({
      title: "Booking Marked as Paid",
      description: "The booking has been marked as fully paid",
    })
  }

  // Change booking status
  const changeBookingStatus = (id: string, status: BookingStatus) => {
    setBookingData((prev) =>
      prev.map((booking) =>
        booking.id === id
          ? {
              ...booking,
              status,
              updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            }
          : booking,
      ),
    )

    toast({
      title: "Status Updated",
      description: `Booking status changed to ${status}`,
    })
  }

  // View booking details
  const viewBookingDetails = (booking: BookingData) => {
    setSelectedBooking(booking)
    setShowBookingDetails(true)
  }

  // Generate receipt for a booking
  const generateReceipt = (booking: BookingData) => {
    setSelectedBooking(booking)
    setShowReceiptModal(true)
  }

  // Print receipt
  const printReceipt = () => {
    if (!selectedBooking) return

    const receiptWindow = window.open("", "_blank")
    if (!receiptWindow) {
      toast({
        title: "Error",
        description: "Could not open print window. Please check your popup blocker settings.",
        variant: "destructive",
      })
      return
    }

    const stayDuration =
      selectedBooking.checkOutDate && selectedBooking.checkInDate
        ? differenceInDays(parseISO(selectedBooking.checkOutDate), parseISO(selectedBooking.checkInDate))
        : 0

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Booking Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .receipt { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; }
            .header { text-align: center; margin-bottom: 20px; }
            .details { margin-bottom: 20px; }
            .details table { width: 100%; border-collapse: collapse; }
            .details th, .details td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            .summary { margin-top: 30px; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>Booking Receipt</h1>
              <p>Receipt #: ${selectedBooking.id.substring(0, 8)}</p>
              <p>Date: ${format(new Date(), "MMMM d, yyyy")}</p>
            </div>
            
            <div class="details">
              <h2>Booking Details</h2>
              <table>
                <tr>
                  <th>Client & Room:</th>
                  <td>${selectedBooking.clientAndRoom}</td>
                </tr>
                <tr>
                  <th>Check-in Date:</th>
                  <td>${selectedBooking.checkInDate}</td>
                </tr>
                <tr>
                  <th>Check-out Date:</th>
                  <td>${selectedBooking.checkOutDate || "N/A"}</td>
                </tr>
                <tr>
                  <th>Duration:</th>
                  <td>${stayDuration} ${stayDuration === 1 ? "night" : "nights"}</td>
                </tr>
                <tr>
                  <th>Number of Guests:</th>
                  <td>${selectedBooking.guestCount}</td>
                </tr>
                <tr>
                  <th>Room Type:</th>
                  <td>${selectedBooking.roomType || "Standard"}</td>
                </tr>
              </table>
            </div>
            
            <div class="summary">
              <h2>Payment Summary</h2>
              <table>
                <tr>
                  <th>Total Amount:</th>
                  <td>$${selectedBooking.totalAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <th>Advance Payment:</th>
                  <td>$${selectedBooking.advancePayment.toFixed(2)}</td>
                </tr>
                <tr>
                  <th>Paid Amount:</th>
                  <td>$${selectedBooking.paidAmount.toFixed(2)}</td>
                </tr>
                <tr class="total">
                  <th>Remaining Balance:</th>
                  <td>$${selectedBooking.remainingBalance.toFixed(2)}</td>
                </tr>
                <tr>
                  <th>Status:</th>
                  <td>${selectedBooking.isPaid ? "Fully Paid" : "Balance Due"}</td>
                </tr>
              </table>
            </div>
            
            <div class="footer">
              <p>Thank you for your business!</p>
              <p>For questions or concerns, please contact us.</p>
            </div>
          </div>
        </body>
      </html>
    `)

    receiptWindow.document.close()
    receiptWindow.focus()
    receiptWindow.print()

    setShowReceiptModal(false)
  }

  // Clear all data
  const clearData = () => {
    setBookingData([])
    setUpcomingBookings([])
    setExcelData([])
    setFileError(null)
    setShowManualAssignment(false)
    localStorage.removeItem("bookingData")

    toast({
      title: "Data Cleared",
      description: "All booking data has been cleared",
    })
  }

  // Export data to Excel
  const exportToExcel = () => {
    if (bookingData.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Add some bookings before exporting",
        variant: "destructive",
      })
      return
    }

    // Convert data to Excel format
    const exportData = bookingData.map((booking) => ({
      "Check-in Date": booking.checkInDate,
      "Check-out Date": booking.checkOutDate,
      "Client & Room": booking.clientAndRoom,
      "Total Amount": booking.totalAmount,
      "Advance Payment": booking.advancePayment,
      "Paid Amount": booking.paidAmount,
      "Remaining Balance": booking.remainingBalance,
      Status: booking.status,
      "Guest Count": booking.guestCount,
      "Room Type": booking.roomType,
      Notes: booking.notes,
      Created: booking.createdAt,
      Updated: booking.updatedAt,
    }))

    // Create worksheet
    const ws = utils.json_to_sheet(exportData)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, "Bookings")

    // Generate Excel file
    const excelBuffer = write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })

    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `booking_tracker_${format(new Date(), "yyyy-MM-dd")}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Successful",
      description: `Exported ${bookingData.length} bookings to Excel`,
    })
  }

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery("")
    setDateRangeFilter({ from: undefined, to: undefined })
    setStatusFilter("all")
    setRoomTypeFilter("all")
    setActiveTab("all")

    toast({
      title: "Filters Reset",
      description: "All filters have been cleared",
    })
  }

  // Filter and sort bookings
  const filteredAndSortedBookings = useMemo(() => {
    // First apply tab filter
    let filtered = [...bookingData]

    switch (activeTab) {
      case "paid":
        filtered = filtered.filter((booking) => booking.isPaid)
        break
      case "unpaid":
        filtered = filtered.filter((booking) => !booking.isPaid)
        break
      case "upcoming":
        const today = new Date()
        const todayStr = format(today, "yyyy-MM-dd")
        filtered = filtered.filter(
          (booking) =>
            booking.checkInDate >= todayStr && booking.status !== "cancelled" && booking.status !== "completed",
        )
        break
      case "completed":
        filtered = filtered.filter((booking) => booking.status === "completed")
        break
      case "cancelled":
        filtered = filtered.filter((booking) => booking.status === "cancelled")
        break
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (booking) =>
          booking.clientAndRoom.toLowerCase().includes(query) ||
          booking.roomType.toLowerCase().includes(query) ||
          booking.notes.toLowerCase().includes(query),
      )
    }

    // Apply date range filter
    if (dateRangeFilter.from || dateRangeFilter.to) {
      filtered = filtered.filter((booking) => {
        const checkInDate = parseISO(booking.checkInDate)

        if (dateRangeFilter.from && dateRangeFilter.to) {
          return isAfter(checkInDate, dateRangeFilter.from) && isBefore(checkInDate, dateRangeFilter.to)
        } else if (dateRangeFilter.from) {
          return isAfter(checkInDate, dateRangeFilter.from) || isEqual(checkInDate, dateRangeFilter.from)
        } else if (dateRangeFilter.to) {
          return isBefore(checkInDate, dateRangeFilter.to) || isEqual(checkInDate, dateRangeFilter.to)
        }

        return true
      })
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((booking) => booking.status === statusFilter)
    }

    // Apply room type filter
    if (roomTypeFilter !== "all") {
      filtered = filtered.filter((booking) => booking.roomType === roomTypeFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "checkInDate":
          comparison = a.checkInDate.localeCompare(b.checkInDate)
          break
        case "checkOutDate":
          comparison = (a.checkOutDate || "").localeCompare(b.checkOutDate || "")
          break
        case "clientAndRoom":
          comparison = a.clientAndRoom.localeCompare(b.clientAndRoom)
          break
        case "totalAmount":
          comparison = a.totalAmount - b.totalAmount
          break
        case "remainingBalance":
          comparison = a.remainingBalance - b.remainingBalance
          break
        case "status":
          comparison = a.status.localeCompare(b.status)
          break
        default:
          comparison = a.checkInDate.localeCompare(b.checkInDate)
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [bookingData, activeTab, searchQuery, dateRangeFilter, statusFilter, roomTypeFilter, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedBookings.length / itemsPerPage)
  const paginatedBookings = filteredAndSortedBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  )

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Booking & Payment Tracker</h1>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme("light")} className="hidden dark:flex">
              <Sun className="h-5 w-5" />
              <span className="sr-only">Light Mode</span>
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setTheme("dark")} className="flex dark:hidden">
              <Moon className="h-5 w-5" />
              <span className="sr-only">Dark Mode</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setActiveView(activeView === "bookings" ? "dashboard" : "bookings")}
            >
              {activeView === "bookings" ? (
                <>
                  <BarChart4 className="mr-2 h-4 w-4" /> Dashboard
                </>
              ) : (
                <>
                  <Home className="mr-2 h-4 w-4" /> Bookings
                </>
              )}
            </Button>
          </div>
        </div>

        {activeView === "dashboard" ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.totalBookings}</div>
                <p className="text-xs text-muted-foreground">{dashboardStats.upcomingBookings} upcoming</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${dashboardStats.totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">${dashboardStats.pendingRevenue.toFixed(2)} pending</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(dashboardStats.occupancyRate)}%</div>
                <Progress value={dashboardStats.occupancyRate} className="h-2 mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Stay</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.averageStay.toFixed(1)} days</div>
                <p className="text-xs text-muted-foreground">Per booking</p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Upcoming Check-ins</CardTitle>
                <CardDescription>Bookings with check-in in the next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingBookings.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {upcomingBookings.map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <p className="font-medium">{booking.clientAndRoom}</p>
                            <p className="text-sm text-muted-foreground">Check-in: {booking.checkInDate}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${booking.totalAmount.toFixed(2)}</p>
                            <Badge variant={booking.isPaid ? "default" : "destructive"}>
                              {booking.isPaid ? "Paid" : "Balance Due"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No upcoming check-ins in the next 7 days</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Payment Status</CardTitle>
                <CardDescription>Overview of payment status for all bookings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Paid</span>
                      <span className="text-sm text-muted-foreground">
                        {bookingData.filter((b) => b.isPaid).length} bookings
                      </span>
                    </div>
                    <Progress
                      value={
                        bookingData.length > 0
                          ? (bookingData.filter((b) => b.isPaid).length / bookingData.length) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Unpaid</span>
                      <span className="text-sm text-muted-foreground">
                        {bookingData.filter((b) => !b.isPaid).length} bookings
                      </span>
                    </div>
                    <Progress
                      value={
                        bookingData.length > 0
                          ? (bookingData.filter((b) => !b.isPaid).length / bookingData.length) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Confirmed</span>
                      <span className="text-sm text-muted-foreground">
                        {bookingData.filter((b) => b.status === "confirmed").length} bookings
                      </span>
                    </div>
                    <Progress
                      value={
                        bookingData.length > 0
                          ? (bookingData.filter((b) => b.status === "confirmed").length / bookingData.length) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Pending</span>
                      <span className="text-sm text-muted-foreground">
                        {bookingData.filter((b) => b.status === "pending").length} bookings
                      </span>
                    </div>
                    <Progress
                      value={
                        bookingData.length > 0
                          ? (bookingData.filter((b) => b.status === "pending").length / bookingData.length) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Completed</span>
                      <span className="text-sm text-muted-foreground">
                        {bookingData.filter((b) => b.status === "completed").length} bookings
                      </span>
                    </div>
                    <Progress
                      value={
                        bookingData.length > 0
                          ? (bookingData.filter((b) => b.status === "completed").length / bookingData.length) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Cancelled</span>
                      <span className="text-sm text-muted-foreground">
                        {bookingData.filter((b) => b.status === "cancelled").length} bookings
                      </span>
                    </div>
                    <Progress
                      value={
                        bookingData.length > 0
                          ? (bookingData.filter((b) => b.status === "cancelled").length / bookingData.length) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>{editingBooking ? "Edit Booking" : "Add New Booking"}</CardTitle>
                  <CardDescription>
                    {editingBooking ? "Update booking information" : "Enter booking details or import from Excel"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!editingBooking && (
                    <>
                      \`\`\`jsx
                      <div
                        className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md hover:bg-muted/50 transition-colors"
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()

                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            const file = e.dataTransfer.files[0]
                            const fileExtension = file.name.split(".").pop()?.toLowerCase()

                            if (fileExtension === "xlsx" || fileExtension === "xls") {
                              handleFileUpload({ target: { files: e.dataTransfer.files } } as any)
                            } else {
                              toast({
                                title: "Invalid File Type",
                                description: "Please upload an Excel file (.xlsx or .xls)",
                                variant: "destructive",
                              })
                            }
                          }
                        }}
                      >
                        <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium mb-1">Upload Excel File</p>
                        <p className="text-xs text-muted-foreground mb-2">Click to browse or drag and drop</p>
                        <p className="text-xs text-muted-foreground">Supports .xlsx and .xls files</p>

                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={isLoading}
                          aria-label="Upload Excel file"
                          data-testid="excel-file-upload"
                        />

                        {isLoading && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
                            <div className="text-center">
                              <Progress className="w-48 mb-2" value={50} />
                              <p className="text-sm text-muted-foreground">Processing file...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      \`\`\`
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">Or add manually</span>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="check-in-date">Check-in Date*</Label>
                      <Input
                        id="check-in-date"
                        type="date"
                        value={newCheckInDate}
                        onChange={(e) => setNewCheckInDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="check-out-date">Check-out Date</Label>
                      <Input
                        id="check-out-date"
                        type="date"
                        value={newCheckOutDate}
                        onChange={(e) => setNewCheckOutDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client-room">Client & Room*</Label>
                    <Input
                      id="client-room"
                      placeholder="Client name and room"
                      value={newClientRoom}
                      onChange={(e) => setNewClientRoom(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="room-type">Room Type</Label>
                      <Input
                        id="room-type"
                        placeholder="Room type"
                        value={newRoomType}
                        onChange={(e) => setNewRoomType(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guest-count">Guest Count</Label>
                      <Input
                        id="guest-count"
                        type="number"
                        min="1"
                        placeholder="Number of guests"
                        value={newGuestCount}
                        onChange={(e) => setNewGuestCount(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="total-amount">Total Amount</Label>
                      <Input
                        id="total-amount"
                        placeholder="Total amount owed"
                        value={newTotalAmount}
                        onChange={(e) => setNewTotalAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="advance-payment">Advance Payment</Label>
                      <Input
                        id="advance-payment"
                        placeholder="Amount paid in advance"
                        value={newAdvancePayment}
                        onChange={(e) => setNewAdvancePayment(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paid-amount">Paid Amount</Label>
                      <Input
                        id="paid-amount"
                        placeholder="Amount paid on-site"
                        value={newPaidAmount}
                        onChange={(e) => setNewPaidAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Booking Status</Label>
                    <Select value={newStatus} onValueChange={(value) => setNewStatus(value as BookingStatus)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Additional notes"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {editingBooking ? (
                    <div className="flex space-x-2">
                      <Button className="flex-1" onClick={updateBooking}>
                        <Save className="mr-2 h-4 w-4" /> Update Booking
                      </Button>
                      <Button variant="outline" onClick={cancelEdit}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={addNewBooking}>
                      <Plus className="mr-2 h-4 w-4" /> Add Booking
                    </Button>
                  )}

                  {fileError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{fileError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={clearData} disabled={bookingData.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear All
                  </Button>
                  <Button variant="outline" onClick={exportToExcel} disabled={bookingData.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Check-ins Due in One Week</CardTitle>
                  <CardDescription>
                    {upcomingBookings.length} {upcomingBookings.length === 1 ? "booking" : "bookings"} with check-in
                    exactly one week from today
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {upcomingBookings.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingBookings.map((booking) => (
                        <Alert key={booking.id} variant={booking.isPaid ? "default" : "destructive"}>
                          {booking.isPaid ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          <AlertTitle className="flex justify-between">
                            <span>{booking.clientAndRoom}</span>
                            <span className="font-semibold">${booking.totalAmount.toFixed(2)}</span>
                          </AlertTitle>
                          <AlertDescription className="flex justify-between">
                            <span>
                              Check-in: {booking.checkInDate}
                              {booking.checkOutDate && <span className="ml-2">Check-out: {booking.checkOutDate}</span>}
                            </span>
                            <span className="text-sm">
                              {booking.isPaid ? "Fully Paid" : `Balance: $${booking.remainingBalance.toFixed(2)}`}
                            </span>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="mx-auto h-12 w-12 mb-4" />
                      <p>
                        {bookingData.length > 0
                          ? "No check-ins due in exactly one week"
                          : "Add bookings to see what's due next week"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Booking List</CardTitle>
                    <CardDescription>
                      {filteredAndSortedBookings.length}{" "}
                      {filteredAndSortedBookings.length === 1 ? "booking" : "bookings"} found
                    </CardDescription>
                  </div>

                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search bookings..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                    </Button>
                  </div>
                </div>

                {showFilters && (
                  <div className="mt-4 p-4 border rounded-md space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Date Range</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left">
                              <Calendar className="mr-2 h-4 w-4" />
                              {dateRangeFilter.from ? (
                                dateRangeFilter.to ? (
                                  <>
                                    {format(dateRangeFilter.from, "LLL dd, y")} -{" "}
                                    {format(dateRangeFilter.to, "LLL dd, y")}
                                  </>
                                ) : (
                                  format(dateRangeFilter.from, "LLL dd, y")
                                )
                              ) : (
                                "Select date range"
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="range"
                              selected={{
                                from: dateRangeFilter.from,
                                to: dateRangeFilter.to,
                              }}
                              onSelect={(range) => setDateRangeFilter(range || { from: undefined, to: undefined })}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={statusFilter}
                          onValueChange={(value) => setStatusFilter(value as BookingStatus | "all")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Filter by status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Room Type</Label>
                        <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Filter by room type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Room Types</SelectItem>
                            {uniqueRoomTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type || "Unspecified"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        Reset Filters
                      </Button>
                    </div>
                  </div>
                )}

                <Tabs defaultValue="all" onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-3 md:grid-cols-6">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="paid">Fully Paid</TabsTrigger>
                    <TabsTrigger value="unpaid">Balance Due</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                    <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {paginatedBookings.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("checkInDate")}>
                            <div className="flex items-center">
                              Check-in
                              {sortField === "checkInDate" && (
                                <ArrowUpDown
                                  className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`}
                                />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("checkOutDate")}>
                            <div className="flex items-center">
                              Check-out
                              {sortField === "checkOutDate" && (
                                <ArrowUpDown
                                  className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`}
                                />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("clientAndRoom")}>
                            <div className="flex items-center">
                              Client & Room
                              {sortField === "clientAndRoom" && (
                                <ArrowUpDown
                                  className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`}
                                />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("totalAmount")}>
                            <div className="flex items-center">
                              Total
                              {sortField === "totalAmount" && (
                                <ArrowUpDown
                                  className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`}
                                />
                              )}
                            </div>
                          </TableHead>
                          <TableHead>Advance</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("remainingBalance")}>
                            <div className="flex items-center">
                              Balance
                              {sortField === "remainingBalance" && (
                                <ArrowUpDown
                                  className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`}
                                />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                            <div className="flex items-center">
                              Status
                              {sortField === "status" && (
                                <ArrowUpDown
                                  className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`}
                                />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBookings.map((booking) => {
                          const today = new Date()
                          const oneWeekFromNow = addDays(today, 7)
                          const oneWeekFromNowStr = format(oneWeekFromNow, "yyyy-MM-dd")

                          const isDueInOneWeek = booking.checkInDate === oneWeekFromNowStr

                          return (
                            <TableRow
                              key={booking.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => viewBookingDetails(booking)}
                            >
                              <TableCell>{booking.checkInDate}</TableCell>
                              <TableCell>{booking.checkOutDate || "-"}</TableCell>
                              <TableCell className="font-medium">
                                <div>
                                  {booking.clientAndRoom}
                                  {booking.roomType && (
                                    <Badge variant="outline" className="ml-2">
                                      {booking.roomType}
                                    </Badge>
                                  )}
                                </div>
                                {booking.guestCount > 1 && (
                                  <span className="text-xs text-muted-foreground">{booking.guestCount} guests</span>
                                )}
                              </TableCell>
                              <TableCell>${booking.totalAmount.toFixed(2)}</TableCell>
                              <TableCell>${booking.advancePayment.toFixed(2)}</TableCell>
                              <TableCell>${booking.paidAmount.toFixed(2)}</TableCell>
                              <TableCell>${booking.remainingBalance.toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Badge
                                    className={
                                      booking.status === "confirmed"
                                        ? "bg-green-500"
                                        : booking.status === "pending"
                                          ? "bg-yellow-500"
                                          : booking.status === "completed"
                                            ? "bg-blue-500"
                                            : "bg-red-500"
                                    }
                                  >
                                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                  </Badge>
                                  {isDueInOneWeek && (
                                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                      Soon
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <SlidersHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => startEditBooking(booking)}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => markAsPaid(booking.id)}>
                                        <CheckCircle className="mr-2 h-4 w-4" /> Mark as Paid
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => generateReceipt(booking)}>
                                        <FileText className="mr-2 h-4 w-4" /> Generate Receipt
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => confirmDeleteBooking(booking.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="mx-auto h-12 w-12 mb-4" />
                    <p>No booking data available. Add bookings to get started.</p>
                  </div>
                )}

                {filteredAndSortedBookings.length > itemsPerPage && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, filteredAndSortedBookings.length)} of{" "}
                      {filteredAndSortedBookings.length} bookings
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Booking Details Dialog */}
        <Dialog open={showBookingDetails} onOpenChange={setShowBookingDetails}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
              <DialogDescription>Complete information about this booking</DialogDescription>
            </DialogHeader>

            {selectedBooking && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium">Client & Room</h3>
                    <p>{selectedBooking.clientAndRoom}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Room Type</h3>
                    <p>{selectedBooking.roomType || "Not specified"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium">Check-in Date</h3>
                    <p>{selectedBooking.checkInDate}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Check-out Date</h3>
                    <p>{selectedBooking.checkOutDate || "Not specified"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium">Guest Count</h3>
                    <p>
                      {selectedBooking.guestCount} {selectedBooking.guestCount === 1 ? "guest" : "guests"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Status</h3>
                    <Badge
                      className={
                        selectedBooking.status === "confirmed"
                          ? "bg-green-500"
                          : selectedBooking.status === "pending"
                            ? "bg-yellow-500"
                            : selectedBooking.status === "completed"
                              ? "bg-blue-500"
                              : "bg-red-500"
                      }
                    >
                      {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium">Total Amount</h3>
                    <p className="font-semibold">${selectedBooking.totalAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Payment Status</h3>
                    <Badge variant={selectedBooking.isPaid ? "default" : "destructive"}>
                      {selectedBooking.isPaid ? "Fully Paid" : "Balance Due"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium">Advance Payment</h3>
                    <p>${selectedBooking.advancePayment.toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Paid Amount</h3>
                    <p>${selectedBooking.paidAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Remaining Balance</h3>
                    <p className={selectedBooking.remainingBalance > 0 ? "text-red-500 font-semibold" : ""}>
                      ${selectedBooking.remainingBalance.toFixed(2)}
                    </p>
                  </div>
                </div>

                {selectedBooking.notes && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium">Notes</h3>
                      <p className="text-sm mt-1">{selectedBooking.notes}</p>
                    </div>
                  </>
                )}

                <div className="text-xs text-muted-foreground mt-4">
                  <p>Created: {format(new Date(selectedBooking.createdAt), "PPpp")}</p>
                  <p>Last Updated: {format(new Date(selectedBooking.updatedAt), "PPpp")}</p>
                </div>
              </div>
            )}

            <DialogFooter className="flex justify-between">
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => startEditBooking(selectedBooking!)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    generateReceipt(selectedBooking!)
                    setShowBookingDetails(false)
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" /> Receipt
                </Button>
              </div>
              <Button variant="default" onClick={() => setShowBookingDetails(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Receipt Modal */}
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Booking Receipt</DialogTitle>
              <DialogDescription>Print or save this receipt for your records</DialogDescription>
            </DialogHeader>

            {selectedBooking && (
              <div className="space-y-4 border p-4 rounded-md">
                <div className="text-center">
                  <h2 className="font-bold text-lg">Booking Receipt</h2>
                  <p className="text-sm text-muted-foreground">Receipt #{selectedBooking.id.substring(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(), "MMMM d, yyyy")}</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Client & Room:</span>
                    <span>{selectedBooking.clientAndRoom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Check-in Date:</span>
                    <span>{selectedBooking.checkInDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Check-out Date:</span>
                    <span>{selectedBooking.checkOutDate || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Room Type:</span>
                    <span>{selectedBooking.roomType || "Standard"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Guests:</span>
                    <span>{selectedBooking.guestCount}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Total Amount:</span>
                    <span>${selectedBooking.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Advance Payment:</span>
                    <span>${selectedBooking.advancePayment.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Paid Amount:</span>
                    <span>${selectedBooking.paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Remaining Balance:</span>
                    <span>${selectedBooking.remainingBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <span>{selectedBooking.isPaid ? "Fully Paid" : "Balance Due"}</span>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground mt-4">
                  <p>Thank you for your business!</p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReceiptModal(false)}>
                Close
              </Button>
              <Button onClick={printReceipt}>
                <Printer className="mr-2 h-4 w-4" /> Print Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this booking? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteBooking}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Column Assignment Dialog */}
        <Dialog open={showManualAssignment} onOpenChange={setShowManualAssignment}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Excel Columns</DialogTitle>
              <DialogDescription>
                Select which columns contain check-in date, check-out date, client/room, and payment information.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="check-in-column" className="text-right">
                  Check-in Date*
                </Label>
                <Select value={checkInColumn} onValueChange={setCheckInColumn}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select check-in date column" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="check-out-column" className="text-right">
                  Check-out Date
                </Label>
                <Select value={checkOutColumn} onValueChange={setCheckOutColumn}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select check-out date column (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {availableColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="client-room-column" className="text-right">
                  Client & Room*
                </Label>
                <Select value={clientRoomColumn} onValueChange={setClientRoomColumn}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select client/room column" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="total-amount-column" className="text-right">
                  Total Amount
                </Label>
                <Select value={totalAmountColumn} onValueChange={setTotalAmountColumn}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select total amount column (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {availableColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="advance-payment-column" className="text-right">
                  Advance Payment
                </Label>
                <Select value={advancePaymentColumn} onValueChange={setAdvancePaymentColumn}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select advance payment column (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {availableColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="paid-amount-column" className="text-right">
                  Paid Amount
                </Label>
                <Select value={paidAmountColumn} onValueChange={setPaidAmountColumn}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select paid amount column (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {availableColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManualAssignment(false)}>
                Cancel
              </Button>
              <Button onClick={processExcelData}>Process Data</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ThemeProvider>
  )
}
