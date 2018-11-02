import { mapFieldsToModel } from './lib/utils'
import { r, User } from '../models'
import { getAuth0Skipper } from '../auth-passport'

export function buildUserOrganizationQuery(queryParam, organizationId, role, campaignId) {
  const roleFilter = role ? { role } : {}

  queryParam
    .from('user_organization')
    .innerJoin('user', 'user_organization.user_id', 'user.id')
    .where(roleFilter)
    .where({ 'user_organization.organization_id': organizationId })
    .distinct()

  if (campaignId) {
    queryParam.innerJoin('assignment', 'assignment.user_id', 'user.id')
    .where({ 'assignment.campaign_id': campaignId })
  }
  return queryParam
}

export const resolvers = {
  User: {
    ...mapFieldsToModel([
      'id',
      'firstName',
      'lastName',
      'email',
      'cell',
      'assignedCell',
      'terms'
    ], User),
    displayName: (user) => `${user.first_name} ${user.last_name}`,
    assignment: async (user, { campaignId }) => r.table('assignment')
      .getAll(user.id, { index: 'user_id' })
      .filter({ campaign_id: campaignId })
      .limit(1)(0)
      .default(null),
    organizations: async (user, { role }) => {
      if (!user || !user.id) {
        return []
      }
      let orgs = r.table('user_organization')
        .getAll(user.id, { index: 'user_id' })
      if (role) {
        orgs = orgs.filter({ role })
      }
      return orgs.eqJoin('organization_id', r.table('organization'))('right').distinct()
    },
    roles: async(user, { organizationId }) => (
      r.table('user_organization')
        .getAll([organizationId, user.id], { index: 'organization_user' })
        .pluck('role')('role')
    ),
    fastLogin: async (texter, { organizationId }, { user }) => {
      if (process.env.AUTH0_SHORT_CIRCUIT_INSECUREHASH) {
        const token = getAuth0Skipper(texter.id)
        return `/loginfast?o=${organizationId}&id=${texter.id}&h=${token}`
      }
      return null
    },
    todos: async (user, { organizationId }) =>
      r.table('assignment')
        .getAll(user.id, { index: 'assignment.user_id' })
        .eqJoin('campaign_id', r.table('campaign'))
        .filter({ 'is_started': true,
                 'organization_id': organizationId,
                 'is_archived': false }
               )('left')

  }
}
