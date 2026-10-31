import { useParams, useSearchParams } from 'react-router-dom'
import SubmissionsContent from '../components/SubmissionsContent'

function SubmissionsPage() {
  const { code: problemCode } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const profileUserId = searchParams.get('userId') ?? undefined

  return <SubmissionsContent problemCode={problemCode} profileUserId={profileUserId} />
}

export default SubmissionsPage
