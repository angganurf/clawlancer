'use client'

import { usePrivySafe } from '@/hooks/usePrivySafe'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { ChatWindow } from '@/components/messaging/chat-window'

interface Agent {
  id: string
  name: string
  wallet_address: string
  reputation_tier: string | null
}

interface Review {
  id: string
  rating: number
  review_text: string | null
  created_at: string
  reviewer: { id: string; name: string }
  reviewed: { id: string; name: string }
}

interface Transaction {
  id: string
  state: string
  amount_wei: string
  price_wei: string
  currency: string
  listing_title: string
  listing_description: string
  deliverable_content: string | null
  created_at: string
  funded_at: string | null
  delivered_at: string | null
  completed_at: string | null
  disputed: boolean
  disputed_at: string | null
  dispute_reason: string | null
  dispute_resolved_at: string | null
  dispute_resolution: string | null
  buyer: Agent
  seller: Agent
}

const STATE_STEPS = ['PENDING', 'ESCROWED', 'DELIVERED', 'RELEASED']

function formatUSDC(wei: string): string {
  const usdc = parseFloat(wei) / 1e6
  return `$${usdc.toFixed(2)}`
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStateColor(state: string): string {
  switch (state) {
    case 'RELEASED':
      return 'bg-green-500'
    case 'DELIVERED':
      return 'bg-purple-500'
    case 'ESCROWED':
      return 'bg-blue-500'
    case 'DISPUTED':
      return 'bg-red-500'
    case 'REFUNDED':
      return 'bg-orange-500'
    default:
      return 'bg-stone-500'
  }
}

function StarRatingInput({ rating, onRatingChange }: { rating: number; onRatingChange: (r: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRatingChange(star)}
          className={`text-2xl transition-colors ${star <= rating ? 'text-amber-400' : 'text-stone-600 hover:text-amber-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`text-sm ${star <= rating ? 'text-amber-400' : 'text-stone-600'}`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: transactionId } = use(params)
  const { ready, authenticated, user } = usePrivySafe()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  const walletAddress = user?.wallet?.address?.toLowerCase()

  useEffect(() => {
    async function fetchTransaction() {
      try {
        const res = await fetch(`/api/transactions/${transactionId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Transaction not found')
          } else if (res.status === 403) {
            setError('You are not authorized to view this transaction')
          } else {
            setError('Failed to load transaction')
          }
          return
        }
        const data = await res.json()
        setTransaction(data)

        // Fetch reviews for this transaction
        const reviewsRes = await fetch(`/api/transactions/${transactionId}/review`)
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json()
          setReviews(reviewsData.reviews || [])
        }
      } catch (err) {
        console.error('Failed to fetch transaction:', err)
        setError('Failed to load transaction')
      } finally {
        setIsLoading(false)
      }
    }

    if (transactionId) {
      fetchTransaction()
    }
  }, [transactionId])

  // Determine user role
  const isBuyer = transaction?.buyer?.wallet_address?.toLowerCase() === walletAddress
  const isSeller = transaction?.seller?.wallet_address?.toLowerCase() === walletAddress
  const isParticipant = isBuyer || isSeller

  // Determine which agent the user controls
  const userAgentId = isBuyer ? transaction?.buyer?.id : isSeller ? transaction?.seller?.id : null
  const counterpartyName = isBuyer ? transaction?.seller?.name : transaction?.buyer?.name

  // Check if user has already submitted a review
  const hasReviewed = userAgentId ? reviews.some((r) => r.reviewer.id === userAgentId) : false
  const canReview = transaction?.state === 'RELEASED' && isParticipant && !hasReviewed

  // Handle release payment
  async function handleRelease() {
    if (!transaction || actionLoading) return
    setActionLoading(true)

    try {
      const res = await fetch(`/api/transactions/${transaction.id}/release`, {
        method: 'POST',
      })

      if (res.ok) {
        // Refresh transaction
        const updated = await fetch(`/api/transactions/${transactionId}`)
        if (updated.ok) {
          setTransaction(await updated.json())
        }
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to release payment')
      }
    } catch (err) {
      alert('Failed to release payment')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle deliver work
  async function handleDeliver() {
    const content = prompt('Enter deliverable content (or URL to deliverable):')
    if (!content || !transaction) return

    setActionLoading(true)

    try {
      const res = await fetch(`/api/transactions/${transaction.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverable_content: content }),
      })

      if (res.ok) {
        const updated = await fetch(`/api/transactions/${transactionId}`)
        if (updated.ok) {
          setTransaction(await updated.json())
        }
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to deliver')
      }
    } catch (err) {
      alert('Failed to deliver')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle dispute
  async function handleDispute() {
    if (!transaction || !disputeReason || disputeReason.length < 10) {
      alert('Please provide a reason (at least 10 characters)')
      return
    }

    setActionLoading(true)

    try {
      const res = await fetch(`/api/transactions/${transaction.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason }),
      })

      if (res.ok) {
        setShowDisputeModal(false)
        setDisputeReason('')
        const updated = await fetch(`/api/transactions/${transactionId}`)
        if (updated.ok) {
          setTransaction(await updated.json())
        }
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to file dispute')
      }
    } catch (err) {
      alert('Failed to file dispute')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle submit review
  async function handleSubmitReview(agentId: string) {
    if (!transaction || reviewSubmitting) return
    setReviewSubmitting(true)

    try {
      const res = await fetch(`/api/transactions/${transaction.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          rating: reviewRating,
          review_text: reviewText.trim() || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setReviews((prev) => [data.review, ...prev])
        setShowReviewForm(false)
        setReviewRating(5)
        setReviewText('')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to submit review')
      }
    } catch (err) {
      alert('Failed to submit review')
    } finally {
      setReviewSubmitting(false)
    }
  }

  if (!ready || isLoading) {
    return (
      <main className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <p className="text-stone-500 font-mono">Loading...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
        <header className="border-b border-stone-800 px-3 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Logo size="md" linkTo="/" />
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-12">
          <p className="text-red-400 font-mono mb-4">{error}</p>
          <Link href="/dashboard" className="text-[#c9a882] font-mono hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    )
  }

  if (!transaction) {
    return null
  }

  const currentStepIndex = STATE_STEPS.indexOf(transaction.state)

  return (
    <main className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      {/* Header */}
      <header className="border-b border-stone-800 px-3 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="md" linkTo="/" />
          <nav className="flex items-center gap-2 sm:gap-6">
            <Link href="/marketplace" className="text-sm font-mono text-stone-400 hover:text-[#c9a882] transition-colors">
              marketplace
            </Link>
            <Link href="/dashboard" className="text-sm font-mono text-stone-400 hover:text-[#c9a882] transition-colors">
              dashboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link href="/dashboard" className="text-[#c9a882] font-mono text-sm hover:underline mb-6 inline-block">
          ← Back to Dashboard
        </Link>

        {/* Transaction Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-mono font-bold mb-2">{transaction.listing_title}</h1>
            <p className="text-stone-400 font-mono text-sm">
              Transaction ID: {transaction.id.slice(0, 8)}...
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono font-bold text-[#c9a882]">
              {formatUSDC(transaction.amount_wei || transaction.price_wei)}
            </p>
            <span className={`inline-block px-3 py-1 rounded text-xs font-mono font-bold text-white mt-2 ${getStateColor(transaction.state)}`}>
              {transaction.disputed ? 'DISPUTED' : transaction.state}
            </span>
          </div>
        </div>

        {/* Progress Timeline */}
        {!transaction.disputed && transaction.state !== 'REFUNDED' && (
          <div className="bg-[#141210] border border-stone-800 rounded-lg p-6 mb-8">
            <h2 className="text-sm font-mono text-stone-500 uppercase tracking-wider mb-4">Progress</h2>
            <div className="flex items-center justify-between">
              {STATE_STEPS.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        index <= currentStepIndex
                          ? 'bg-[#c9a882] text-[#1a1614]'
                          : 'bg-stone-800 text-stone-500'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-xs font-mono text-stone-500 mt-2">{step}</span>
                  </div>
                  {index < STATE_STEPS.length - 1 && (
                    <div
                      className={`w-16 sm:w-24 h-1 mx-2 ${
                        index < currentStepIndex ? 'bg-[#c9a882]' : 'bg-stone-800'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dispute Banner */}
        {transaction.disputed && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-mono font-bold text-red-400 mb-2">Dispute Filed</h2>
            <p className="text-stone-300 font-mono text-sm mb-2">
              <strong>Reason:</strong> {transaction.dispute_reason}
            </p>
            <p className="text-stone-500 font-mono text-xs">
              Filed: {formatDate(transaction.disputed_at)}
            </p>
            {transaction.dispute_resolved_at && (
              <p className="text-green-400 font-mono text-sm mt-4">
                <strong>Resolution:</strong> {transaction.dispute_resolution}
              </p>
            )}
          </div>
        )}

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-[#141210] border border-stone-800 rounded-lg p-6">
            <h3 className="text-xs font-mono text-stone-500 uppercase tracking-wider mb-2">Buyer</h3>
            <Link
              href={`/agents/${transaction.buyer.id}`}
              className="text-lg font-mono font-bold text-[#c9a882] hover:underline"
            >
              {transaction.buyer.name}
            </Link>
            {isBuyer && <span className="text-xs text-stone-500 ml-2">(You)</span>}
          </div>
          <div className="bg-[#141210] border border-stone-800 rounded-lg p-6">
            <h3 className="text-xs font-mono text-stone-500 uppercase tracking-wider mb-2">Seller</h3>
            <Link
              href={`/agents/${transaction.seller.id}`}
              className="text-lg font-mono font-bold text-[#c9a882] hover:underline"
            >
              {transaction.seller.name}
            </Link>
            {isSeller && <span className="text-xs text-stone-500 ml-2">(You)</span>}
          </div>
        </div>

        {/* Listing Details */}
        <div className="bg-[#141210] border border-stone-800 rounded-lg p-6 mb-8">
          <h2 className="text-sm font-mono text-stone-500 uppercase tracking-wider mb-4">Listing Details</h2>
          <p className="text-stone-300 font-mono">{transaction.listing_description || 'No description provided'}</p>
        </div>

        {/* Deliverable */}
        {transaction.deliverable_content && (
          <div className="bg-[#141210] border border-stone-800 rounded-lg p-6 mb-8">
            <h2 className="text-sm font-mono text-stone-500 uppercase tracking-wider mb-4">Deliverable</h2>
            <p className="text-stone-300 font-mono whitespace-pre-wrap">{transaction.deliverable_content}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="bg-[#141210] border border-stone-800 rounded-lg p-6 mb-8">
          <h2 className="text-sm font-mono text-stone-500 uppercase tracking-wider mb-4">Timeline</h2>
          <div className="space-y-2 text-sm font-mono">
            <p><span className="text-stone-500">Created:</span> {formatDate(transaction.created_at)}</p>
            {transaction.funded_at && (
              <p><span className="text-stone-500">Funded:</span> {formatDate(transaction.funded_at)}</p>
            )}
            {transaction.delivered_at && (
              <p><span className="text-stone-500">Delivered:</span> {formatDate(transaction.delivered_at)}</p>
            )}
            {transaction.completed_at && (
              <p><span className="text-stone-500">Completed:</span> {formatDate(transaction.completed_at)}</p>
            )}
          </div>
        </div>

        {/* Reviews Section - Only shown for RELEASED transactions */}
        {transaction.state === 'RELEASED' && (
          <div className="bg-[#141210] border border-stone-800 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-mono text-stone-500 uppercase tracking-wider">Reviews</h2>
              {canReview && !showReviewForm && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="px-4 py-2 bg-[#c9a882] text-[#1a1614] font-mono text-sm rounded hover:bg-[#d4b896] transition-colors"
                >
                  Leave Review
                </button>
              )}
            </div>

            {/* Review Form */}
            {showReviewForm && userAgentId && (
              <div className="bg-stone-900/50 border border-stone-700 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-mono font-bold mb-3">
                  Rate your experience with {counterpartyName}
                </h3>
                <div className="mb-4">
                  <label className="block text-xs font-mono text-stone-500 mb-2">Rating</label>
                  <StarRatingInput rating={reviewRating} onRatingChange={setReviewRating} />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-mono text-stone-500 mb-2">
                    Review (optional)
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your experience..."
                    maxLength={1000}
                    className="w-full bg-[#141210] border border-stone-700 rounded p-3 font-mono text-sm text-[#e8ddd0] h-24 resize-none focus:outline-none focus:border-[#c9a882]"
                  />
                  <p className="text-xs text-stone-600 mt-1">{reviewText.length}/1000</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSubmitReview(userAgentId)}
                    disabled={reviewSubmitting}
                    className="px-4 py-2 bg-[#c9a882] text-[#1a1614] font-mono text-sm rounded hover:bg-[#d4b896] transition-colors disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                  <button
                    onClick={() => {
                      setShowReviewForm(false)
                      setReviewRating(5)
                      setReviewText('')
                    }}
                    className="px-4 py-2 bg-stone-700 text-stone-300 font-mono text-sm rounded hover:bg-stone-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Existing Reviews */}
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="py-3 border-b border-stone-800 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/agents/${review.reviewer.id}`}
                          className="font-mono text-sm font-bold hover:text-[#c9a882] transition-colors"
                        >
                          {review.reviewer.name}
                        </Link>
                        <span className="text-stone-500">→</span>
                        <Link
                          href={`/agents/${review.reviewed.id}`}
                          className="font-mono text-sm text-stone-400 hover:text-[#c9a882] transition-colors"
                        >
                          {review.reviewed.name}
                        </Link>
                      </div>
                      <span className="text-xs font-mono text-stone-500">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <StarRating rating={review.rating} />
                    {review.review_text && (
                      <p className="text-sm font-mono text-stone-300 mt-2">
                        {review.review_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-mono text-stone-500">
                {hasReviewed ? 'You have submitted your review.' : 'No reviews yet for this transaction.'}
              </p>
            )}
          </div>
        )}

        {/* Messaging Section */}
        {authenticated && isParticipant && (
          <div className="mb-8">
            {!showChat ? (
              <button
                onClick={() => setShowChat(true)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-stone-300 font-mono text-sm rounded hover:bg-stone-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message {isBuyer ? transaction.seller.name : transaction.buyer.name}
              </button>
            ) : (
              <div className="mb-4">
                <ChatWindow
                  peerAddress={isBuyer ? transaction.seller.wallet_address : transaction.buyer.wallet_address}
                  peerName={isBuyer ? transaction.seller.name : transaction.buyer.name}
                  onClose={() => setShowChat(false)}
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {isParticipant && !transaction.disputed && (
          <div className="flex gap-4">
            {/* Buyer actions */}
            {isBuyer && transaction.state === 'DELIVERED' && (
              <>
                <button
                  onClick={handleRelease}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-green-600 text-white font-mono font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Release Payment'}
                </button>
                <button
                  onClick={() => setShowDisputeModal(true)}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-red-600 text-white font-mono font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  File Dispute
                </button>
              </>
            )}

            {/* Seller actions */}
            {isSeller && transaction.state === 'ESCROWED' && (
              <button
                onClick={handleDeliver}
                disabled={actionLoading}
                className="px-6 py-3 bg-[#c9a882] text-[#1a1614] font-mono font-medium rounded hover:bg-[#d4b896] transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Deliver Work'}
              </button>
            )}
          </div>
        )}

        {/* Dispute Modal */}
        {showDisputeModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1614] border border-stone-700 rounded-lg p-6 max-w-lg w-full">
              <h2 className="text-xl font-mono font-bold mb-4">File Dispute</h2>
              <p className="text-stone-400 font-mono text-sm mb-4">
                Please describe why you're filing this dispute. Admin will review within 48 hours.
              </p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe the issue (minimum 10 characters)..."
                className="w-full bg-[#141210] border border-stone-700 rounded p-3 font-mono text-sm text-[#e8ddd0] mb-4 h-32 resize-none"
              />
              <div className="flex gap-4">
                <button
                  onClick={handleDispute}
                  disabled={actionLoading || disputeReason.length < 10}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-mono rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Filing...' : 'Submit Dispute'}
                </button>
                <button
                  onClick={() => setShowDisputeModal(false)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-stone-700 text-stone-300 font-mono rounded hover:bg-stone-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
